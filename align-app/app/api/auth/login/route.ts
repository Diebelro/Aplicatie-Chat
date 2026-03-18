/**
 * Login: store în memorie sau Prisma (când DATABASE_URL). Returnează profileComplete pentru redirect.
 */
import { NextResponse } from "next/server";
import { findUserByEmail, getPasswordHash, getStoreId, getUsersCount } from "@/lib/store";
import { verifyPassword } from "@/lib/auth";
import { verifyRecaptchaV3 } from "@/lib/recaptcha";
import { findDevice, createDevice, setDeviceTrusted } from "@/lib/devices";
import { createSession, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/sessions";
import {
  isPrismaAvailable,
  prismaFindUserByEmailForLogin,
  prismaGetPasswordHash,
  prismaProfileCompleted,
  prismaUpsertDevice,
} from "@/lib/repo-prisma";

const TEN_MIN_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const loginFailuresByIp = new Map<string, number[]>();
const loginFailuresByFingerprint = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function pruneOld(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

function isLoginRateLimited(ip: string, fingerprint: string | null): boolean {
  const ipList = pruneOld(loginFailuresByIp.get(ip) ?? [], TEN_MIN_MS);
  if (ipList.length >= MAX_FAILED_ATTEMPTS) return true;
  const fp = fingerprint && fingerprint.length > 0 ? fingerprint : null;
  if (fp) {
    const fpList = pruneOld(loginFailuresByFingerprint.get(fp) ?? [], TEN_MIN_MS);
    if (fpList.length >= MAX_FAILED_ATTEMPTS) return true;
  }
  return false;
}

function recordLoginFailure(ip: string, fingerprint: string | null): void {
  const now = Date.now();
  const ipList = pruneOld(loginFailuresByIp.get(ip) ?? [], TEN_MIN_MS);
  ipList.push(now);
  loginFailuresByIp.set(ip, ipList);
  if (fingerprint && fingerprint.length > 0) {
    const fpList = pruneOld(loginFailuresByFingerprint.get(fingerprint) ?? [], TEN_MIN_MS);
    fpList.push(now);
    loginFailuresByFingerprint.set(fingerprint, fpList);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, rememberDevice, recaptchaToken, deviceFingerprint } = body;

    const emailStr = String(email ?? "").trim().toLowerCase();
    if (!emailStr) {
      return NextResponse.json(
        { error: "Lipsește email-ul." },
        { status: 400 }
      );
    }
    if (!emailStr.includes("@")) {
      return NextResponse.json(
        { error: "Introdu emailul, nu username-ul." },
        { status: 400 }
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Lipsește parola." },
        { status: 400 }
      );
    }

    let recaptchaScore = 1;
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (recaptchaSecret && recaptchaToken && typeof recaptchaToken === "string") {
      const recaptcha = await verifyRecaptchaV3(recaptchaToken, "login");
      if (recaptcha.success) recaptchaScore = recaptcha.score ?? 0;
    }

    const ip = getClientIp(request);
    const fp = deviceFingerprint != null ? String(deviceFingerprint).trim().slice(0, 128) : null;

    if (isLoginRateLimited(ip, fp)) {
      const headers: HeadersInit = {};
      if (recaptchaScore > 0.7) headers["Retry-After"] = "600";
      return NextResponse.json(
        { error: "Prea multe încercări, încearcă mai târziu." },
        { status: 429, headers }
      );
    }

    let user: { id: string; email?: string; [key: string]: unknown } | null = null;
    let profileComplete = true;
    let usePrisma = isPrismaAvailable();

    if (usePrisma) {
      try {
        const prismaUser = await prismaFindUserByEmailForLogin(emailStr);
        if (prismaUser) {
          user = { id: prismaUser.id, email: prismaUser.email };
          const hash = await prismaGetPasswordHash(prismaUser.id);
          if (!hash || !verifyPassword(String(password), hash)) {
            recordLoginFailure(ip, fp);
            return NextResponse.json({ error: "Parolă incorectă." }, { status: 401 });
          }
          profileComplete = await prismaProfileCompleted(prismaUser.id);
        }
      } catch (err) {
        console.error("[auth login] Prisma error", err);
        return NextResponse.json(
          { error: "Eroare la conexiunea cu baza de date. Verifică DATABASE_URL în .env și rulează npm run db:setup." },
          { status: 503 }
        );
      }
    }
    if (!user) {
      const localUser = findUserByEmail(emailStr);
      if (localUser) {
        const hash = getPasswordHash(localUser.id);
        if (hash && verifyPassword(String(password), hash)) {
          user = { id: localUser.id, email: localUser.email };
          usePrisma = false;
        }
      }
    }

    if (!user) {
      recordLoginFailure(ip, fp);
      return NextResponse.json(
        { error: "Nu există cont cu acest email. Înregistrează-te mai întâi." },
        { status: 404 }
      );
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const fingerprintForDevice = fp && fp.length > 0 ? fp : `no-fp-${ip}`;
    let deviceId: string;
    let persistent: boolean;

    if (usePrisma) {
      const dev = await prismaUpsertDevice({
        userId: user.id,
        fingerprint: fingerprintForDevice,
        userAgent,
        ip,
        trusted: rememberDevice,
      });
      deviceId = dev.id;
      persistent = rememberDevice;
    } else {
      let device = findDevice(user.id, fingerprintForDevice);
      const isNewDevice = !device;
      if (!device) {
        device = createDevice({
          userId: user.id,
          fingerprint: fingerprintForDevice,
          userAgent,
          ip,
          trusted: false,
        });
      }
      if (isNewDevice) persistent = false;
      else if (rememberDevice) {
        setDeviceTrusted(device.id, true);
        persistent = true;
      } else {
        persistent = device.trusted;
      }
      deviceId = device.id;
    }

    const { sessionId, maxAgeSeconds } = createSession(user.id, deviceId, persistent);
    const cookieOpts = getSessionCookieOptions(maxAgeSeconds);
    const res = NextResponse.json({
      user,
      sessionType: persistent ? "persistent" : "session",
      sessionToken: sessionId,
      deviceId,
      profileComplete,
    });
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      ...(cookieOpts.maxAge != null && { maxAge: cookieOpts.maxAge }),
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Eroare la logare." },
      { status: 500 }
    );
  }
}
