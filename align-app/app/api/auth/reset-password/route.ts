import { NextResponse } from "next/server";
import { findResetToken, markTokenUsed } from "@/lib/passwordReset";
import { findUserById, setPassword } from "@/lib/store";
import { hashPassword } from "@/lib/auth";
import {
  createSession,
  SESSION_COOKIE,
  getSessionCookieOptions,
} from "@/lib/sessions";
import { createDevice as createDeviceRecord, findDevice } from "@/lib/devices";

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

    const entry = findResetToken(token);
    if (!entry) {
      return NextResponse.json(
        { error: "Link invalid sau expirat. Cere un link nou din „Ai uitat parola?”." },
        { status: 400 }
      );
    }

    const user = findUserById(entry.userId);
    if (!user) {
      return NextResponse.json(
        { error: "Cont negăsit." },
        { status: 404 }
      );
    }

    setPassword(user.id, hashPassword(String(password)));
    markTokenUsed(token);

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "";
    let device = findDevice(user.id, `reset-${ip}`);
    if (!device) {
      device = createDeviceRecord({
        userId: user.id,
        fingerprint: `reset-${ip}`,
        userAgent,
        ip,
        trusted: false,
      });
    }


    const { sessionId, maxAgeSeconds } = createSession(user.id, device.id, true);
    const cookieOpts = getSessionCookieOptions(maxAgeSeconds);
    const res = NextResponse.json({ ok: true, user, sessionToken: sessionId, deviceId: device.id });
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
      { error: "Eroare la resetarea parolei." },
      { status: 500 }
    );
  }
}
