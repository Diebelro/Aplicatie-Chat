import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/appUrl";
import { normalizeAuthEmail } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  isPrismaAvailable,
  prismaCreatePasswordResetToken,
  prismaFindUserByEmailForLogin,
} from "@/lib/repo-prisma";
import { findUserByEmail } from "@/lib/store";
import { createResetToken } from "@/lib/passwordReset";

/**
 * Nu dezvăluim dacă emailul există. Dacă Resend nu e configurat, tot returnăm ok (dev: logăm link în consolă).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeAuthEmail(String(body.email ?? ""));
    if (!email) {
      return NextResponse.json(
        { error: "Introdu adresa de email." },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    let resolvedEmail = email;

    if (isPrismaAvailable()) {
      try {
        const u = await prismaFindUserByEmailForLogin(email);
        if (u) {
          userId = u.id;
          resolvedEmail = u.email;
        }
      } catch (err) {
        console.error("[forgot-password] Prisma", err);
        return NextResponse.json(
          { error: "Eroare la baza de date. Încearcă mai târziu." },
          { status: 503 }
        );
      }
    }

    if (!userId) {
      const local = findUserByEmail(email);
      if (local) {
        userId = local.id;
        resolvedEmail = local.email ?? email;
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    let token: string;
    if (isPrismaAvailable()) {
      try {
        const t = await prismaCreatePasswordResetToken(userId);
        token = t.token;
      } catch (err) {
        console.error("[forgot-password] create token", err);
        return NextResponse.json({ ok: true });
      }
    } else {
      token = createResetToken(userId).token;
    }

    const resetLink = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const sent = await sendPasswordResetEmail({
      to: resolvedEmail,
      resetLink,
      expiresInMinutes: 15,
    });

    if (!sent) {
      if (process.env.NODE_ENV === "development") {
        console.info(
          "[forgot-password] Email netrimis (vezi [Resend] mai sus). Link (PUBLIC_APP_URL / NEXT_PUBLIC_APP_URL):\n",
          resetLink
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      { error: "Eroare la trimitere." },
      { status: 500 }
    );
  }
}
