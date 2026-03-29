import { NextResponse } from "next/server";
import { consumeRecoverySession } from "@/lib/recoverySessions";
import { findUserById, setPassword } from "@/lib/store";
import { hashPassword } from "@/lib/auth";
import {
  createSessionAsync,
  SESSION_COOKIE,
  getSessionCookieOptions,
} from "@/lib/sessions";
import { createDevice as createDeviceRecord, findDevice } from "@/lib/devices";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body.sessionId ?? "").trim();
    const newPassword = body.newPassword;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Sesiune invalidă. Încearcă din nou fluxul de recuperare." },
        { status: 400 }
      );
    }
    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json(
        { error: "Parola trebuie să aibă cel puțin 6 caractere." },
        { status: 400 }
      );
    }

    const userId = consumeRecoverySession(sessionId);
    if (!userId) {
      return NextResponse.json(
        { error: "Sesiune invalidă sau expirată. Încearcă din nou." },
        { status: 400 }
      );
    }

    const user = findUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "Cont negăsit." },
        { status: 404 }
      );
    }

    setPassword(user.id, hashPassword(String(newPassword)));

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "";
    let device = findDevice(user.id, `scan-${ip}`);
    if (!device) {
      device = createDeviceRecord({
        userId: user.id,
        fingerprint: `scan-${ip}`,
        userAgent,
        ip,
        trusted: false,
      });
    }

    const { sessionId: sid, maxAgeSeconds } = await createSessionAsync(user.id, device.id, true);
    const cookieOpts = getSessionCookieOptions(maxAgeSeconds);
    const res = NextResponse.json({ ok: true, user, sessionToken: sid, deviceId: device.id });
    res.cookies.set(SESSION_COOKIE, sid, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      ...(cookieOpts.maxAge != null && { maxAge: cookieOpts.maxAge }),
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Eroare la resetarea parolei." },
      { status: 500 }
    );
  }
}
