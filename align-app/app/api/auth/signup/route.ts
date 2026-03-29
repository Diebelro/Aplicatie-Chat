import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/appUrl";
import { createUser, findUserByEmail, findUserByUsername, setPassword, getStoreId, getUsersCount, type Gender } from "@/lib/store";
import { hashPassword, normalizeAuthEmail } from "@/lib/auth";
import { isResendConfigured, sendEmailVerificationEmail } from "@/lib/email";
import { verifyRecaptchaV3, RECAPTCHA_SUSPECT_THRESHOLD } from "@/lib/recaptcha";
import { checkSignupRateLimit, recordSignup } from "@/lib/rateLimitSignup";
import { createDevice, setDeviceTrusted } from "@/lib/devices";
import { createSessionAsync, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/sessions";
import {
  isPrismaAvailable,
  prismaFindUserByEmailForLogin,
  prismaFindUserByUsername,
  prismaCreateUserWithProfile,
  prismaCreateEmailVerificationToken,
  prismaUpsertDevice,
} from "@/lib/repo-prisma";
import { recordApiRouteError } from "@/lib/serverErrorRing";

const VALID_GENDERS: Gender[] = ["male", "female", "other"];

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function isAtLeast18(birthDateStr: string): boolean {
  if (!birthDateStr || birthDateStr.length < 10) return false;
  const birth = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      username: usernameRaw,
      password,
      gender,
      birthDate: birthDateRaw,
      rememberDevice,
      recaptchaToken,
      deviceFingerprint,
    } = body;

    const emailStr = normalizeAuthEmail(String(email ?? ""));
    if (!emailStr) {
      return NextResponse.json(
        { error: "Lipsește email-ul." },
        { status: 400 }
      );
    }

    const usernameStr = String(usernameRaw ?? "").trim();
    if (!usernameStr) {
      return NextResponse.json(
        { error: "Lipsește username-ul." },
        { status: 400 }
      );
    }
    if (usernameStr.length < 2 || usernameStr.length > 30) {
      return NextResponse.json(
        { error: "Username-ul trebuie să aibă între 2 și 30 de caractere." },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(usernameStr)) {
      return NextResponse.json(
        { error: "Username-ul poate conține doar litere, cifre, punct și liniuță jos." },
        { status: 400 }
      );
    }
    const usernameLower = usernameStr.toLowerCase();
    let usePrisma = isPrismaAvailable();
    if (usePrisma) {
      try {
        const existingUser = await prismaFindUserByEmailForLogin(emailStr);
        if (existingUser) {
          return NextResponse.json(
            { error: "Există deja un cont cu acest email. Loghează-te." },
            { status: 409 }
          );
        }
        const existingUsername = await prismaFindUserByUsername(usernameLower);
        if (existingUsername) {
          return NextResponse.json(
            { error: "Acest username este deja folosit. Alege un username unic (ex: ana_maria), nu adresa de email." },
            { status: 409 }
          );
        }
      } catch {
        usePrisma = false;
      }
    }
    if (!usePrisma) {
      if (findUserByEmail(emailStr)) {
        const errMem =
          process.env.NODE_ENV !== "production"
            ? "Există deja acest email în memoria serverului local. Loghează-te cu parola corectă (dacă primeai „nu există cont”, probabil parola era greșită). Repornește npm run dev dacă vrei conte goale."
            : "Există deja un cont cu acest email. Loghează-te.";
        return NextResponse.json({ error: errMem }, { status: 409 });
      }
      const existingByUsername = findUserByUsername(usernameLower);
      if (existingByUsername) {
        return NextResponse.json(
          { error: "Acest username este deja folosit. Alege un username unic (ex: ana_maria), nu adresa de email." },
          { status: 409 }
        );
      }
    }
    if (!password || String(password).length < 6) {
      return NextResponse.json(
        { error: "Parola trebuie să aibă cel puțin 6 caractere." },
        { status: 400 }
      );
    }

    let recaptchaScore = 1;
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (recaptchaSecret) {
      if (!recaptchaToken || typeof recaptchaToken !== "string") {
        return NextResponse.json(
          { error: "Verificarea reCAPTCHA a eșuat." },
          { status: 400 }
        );
      }
      const recaptcha = await verifyRecaptchaV3(recaptchaToken, "signup");
      if (!recaptcha.success) {
        return NextResponse.json(
          { error: "Verificarea reCAPTCHA a eșuat." },
          { status: 400 }
        );
      }
      recaptchaScore = recaptcha.score ?? 0;
      if (recaptchaScore < RECAPTCHA_SUSPECT_THRESHOLD) {
        return NextResponse.json(
          { error: "Activitate suspectă detectată." },
          { status: 400 }
        );
      }
    }

    const fp = deviceFingerprint != null ? String(deviceFingerprint).trim().slice(0, 128) : null;
    const isSuspect = recaptchaScore < 0.5;

    const rateLimit = checkSignupRateLimit(request, fp, isSuspect);
    if (!rateLimit.allowed) {
      const headers: HeadersInit = {};
      if (recaptchaScore > 0.7) headers["Retry-After"] = "600";
      return NextResponse.json(
        { error: "Prea multe încercări, încearcă mai târziu." },
        { status: 429, headers }
      );
    }

    const birthDateStr = birthDateRaw != null ? String(birthDateRaw).trim() : "";
    if (!birthDateStr || !isAtLeast18(birthDateStr)) {
      return NextResponse.json(
        { error: "Trebuie să ai cel puțin 18 ani pentru a crea un cont." },
        { status: 400 }
      );
    }
    const genderVal = gender && VALID_GENDERS.includes(gender) ? gender : undefined;
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";
    const fingerprintForDevice = fp && fp.length > 0 ? fp : `no-fp-${ip}`;
    let user: { id: string; email: string; name: string; username: string };
    let deviceId: string;
    let persistent: boolean;

    if (usePrisma) {
      try {
        user = await prismaCreateUserWithProfile({
          email: emailStr,
          passwordHash: hashPassword(String(password)),
          username: usernameLower,
          name: usernameLower,
          birthDate: birthDateStr,
          gender: genderVal,
        });
        try {
          if (isResendConfigured()) {
            const { token } = await prismaCreateEmailVerificationToken(user.id);
            const verifyLink = `${getPublicAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
            await sendEmailVerificationEmail({ to: user.email, verifyLink });
          }
        } catch (evErr) {
          console.error("[auth signup] Email verificare", evErr);
        }
        const dev = await prismaUpsertDevice({
          userId: user.id,
          fingerprint: fingerprintForDevice,
          userAgent,
          ip,
          trusted: !!rememberDevice,
        });
        deviceId = dev.id;
        persistent = !!rememberDevice;
      } catch (e) {
        console.error("[auth signup] Prisma create failed", e);
        return NextResponse.json({ error: "Eroare la crearea contului." }, { status: 500 });
      }
    } else {
      user = createUser({
        name: usernameLower,
        username: usernameLower,
        email: emailStr,
        bio: "",
        ...(genderVal && { gender: genderVal }),
        birthDate: birthDateStr,
      });
      setPassword(user.id, hashPassword(String(password)));
      const device = createDevice({
        userId: user.id,
        fingerprint: fingerprintForDevice,
        userAgent,
        ip,
        trusted: false,
      });
      if (rememberDevice) setDeviceTrusted(device.id, true);
      deviceId = device.id;
      persistent = Boolean(rememberDevice);
    }

    recordSignup(request, fp, isSuspect);

    const { sessionId, maxAgeSeconds } = await createSessionAsync(user.id, deviceId, persistent);
    const cookieOpts = getSessionCookieOptions(maxAgeSeconds);
    const res = NextResponse.json({
      user,
      sessionType: persistent ? "persistent" : "session",
      sessionToken: sessionId,
      deviceId,
    });
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      ...(cookieOpts.maxAge != null && { maxAge: cookieOpts.maxAge }),
    });
    return res;
  } catch (e) {
    recordApiRouteError("POST /api/auth/signup", e);
    return NextResponse.json(
      { error: "Eroare la crearea contului." },
      { status: 500 }
    );
  }
}
