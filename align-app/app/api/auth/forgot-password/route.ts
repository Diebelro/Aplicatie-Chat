import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/store";
import { createResetToken } from "@/lib/passwordReset";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Introdu adresa de email." },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const { token } = createResetToken(user.id);
    const resetLink = `${BASE_URL}/reset-password?token=${token}`;
    // TODO producție: trimite email cu resetLink (nodemailer, SendGrid, Resend, etc.)

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Eroare la trimitere." },
      { status: 500 }
    );
  }
}
