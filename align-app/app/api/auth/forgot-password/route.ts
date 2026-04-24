import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/apiRateLimitGate";
import { logServerError } from "@/lib/serverLog";
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

/** Citește env la runtime; nu Edge (evită surprize cu `process.env` / NODE_ENV). */
export const runtime = "nodejs";

/**
 * Nu dezvăluim dacă emailul există. Dacă Resend nu e configurat, tot returnăm ok (dev: logăm link în consolă).
 */
export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "/api/auth/forgot-password");
  if (limited) return limited;
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
        logServerError("forgot-password:prisma", err);
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
        logServerError("forgot-password:create-token", err);
        return NextResponse.json({ ok: true });
      }
    } else {
      token = createResetToken(userId).token;
    }

    /** Doar în development: același host ca `npm run dev` (ex. localhost:3005), ca resetarea să meargă fără site public. */
    let devResetLink: string | undefined;
    if (process.env.NODE_ENV === "development") {
      try {
        devResetLink = `${new URL(request.url).origin}/reset-password?token=${encodeURIComponent(token)}`;
      } catch {
        /* ignore */
      }
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

    return NextResponse.json(
      devResetLink ? { ok: true, devResetLink } : { ok: true }
    );
  } catch (err) {
    logServerError("forgot-password", err);
    return NextResponse.json(
      { error: "Eroare la trimitere." },
      { status: 500 }
    );
  }
}
