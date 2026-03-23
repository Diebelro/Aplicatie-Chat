import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { findResetToken, markTokenUsed } from "@/lib/passwordReset";
import {
  isPrismaAvailable,
  prismaCompletePasswordReset,
  prismaUpsertDevice,
} from "@/lib/repo-prisma";
import { findUserById, setPassword } from "@/lib/store";
import {
  createSession,
  SESSION_COOKIE,
  getSessionCookieOptions,
} from "@/lib/sessions";
import { createDevice as createDeviceRecord, findDevice } from "@/lib/devices";

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const password = body.password;

    if (!token) {
      return NextResponse.json(
        { error: "Link invalid sau expirat. Cere un link nou." },
        { status: 400 }
      );
    }
    if (!password || String(password).length < 6) {
      return NextResponse.json(
        { error: "Parola trebuie să aibă cel puțin 6 caractere." },
        { status: 400 }
      );
    }

    const hashed = hashPassword(String(password));
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";
    const fingerprint = `reset-${ip}`;

    let userId: string;
    let userPayload: { id: string; email?: string };

    if (isPrismaAvailable()) {
      try {
        const done = await prismaCompletePasswordReset(token, hashed);
        if (!done) {
          const entry = findResetToken(token);
          if (!entry) {
            return NextResponse.json(
              {
                error:
                  "Link invalid sau expirat. Cere un link nou din „Ai uitat parola?”.",
              },
              { status: 400 }
            );
          }
          const memUser = findUserById(entry.userId);
          if (!memUser) {
            return NextResponse.json({ error: "Cont negăsit." }, { status: 404 });
          }
          setPassword(memUser.id, hashed);
          markTokenUsed(token);
          userId = memUser.id;
          userPayload = { id: memUser.id, email: memUser.email };
        } else {
          userId = done.userId;
          userPayload = { id: done.userId, email: done.email };
        }
      } catch (err) {
        console.error("[reset-password] Prisma", err);
        return NextResponse.json(
          { error: "Eroare la resetarea parolei. Încearcă din nou." },
          { status: 503 }
        );
      }
    } else {
      const entry = findResetToken(token);
      if (!entry) {
        return NextResponse.json(
          {
            error:
              "Link invalid sau expirat. Cere un link nou din „Ai uitat parola?”.",
          },
          { status: 400 }
        );
      }
      const user = findUserById(entry.userId);
      if (!user) {
        return NextResponse.json({ error: "Cont negăsit." }, { status: 404 });
      }
      setPassword(user.id, hashed);
      markTokenUsed(token);
      userId = user.id;
      userPayload = { id: user.id, email: user.email };
    }

    let deviceId: string;
    if (isPrismaAvailable()) {
      const dev = await prismaUpsertDevice({
        userId,
        fingerprint,
        userAgent,
        ip,
        trusted: false,
      });
      deviceId = dev.id;
    } else {
      let device = findDevice(userId, fingerprint);
      if (!device) {
        device = createDeviceRecord({
          userId,
          fingerprint,
          userAgent,
          ip,
          trusted: false,
        });
      }
      deviceId = device.id;
    }

    const { sessionId, maxAgeSeconds } = createSession(userId, deviceId, true);
    const cookieOpts = getSessionCookieOptions(maxAgeSeconds);
    const res = NextResponse.json({
      ok: true,
      user: userPayload,
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
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(
      { error: "Eroare la resetarea parolei." },
      { status: 500 }
    );
  }
}
