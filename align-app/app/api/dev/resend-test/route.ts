import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/appUrl";
import {
  getResendFromEmail,
  isResendConfigured,
  sendTestEmail,
} from "@/lib/email";

/** GET: afișează baza URL folosită la link-uri în email (fără trimitere). Doar development. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const base = getPublicAppUrl();
  return NextResponse.json({
    publicBaseUrl: base,
    sampleResetLink: `${base}/reset-password?token=DEMO_TOKEN`,
    sampleVerifyLink: `${base}/verify-email?token=DEMO_TOKEN`,
    envUsed: process.env.PUBLIC_APP_URL?.trim()
      ? "PUBLIC_APP_URL"
      : process.env.NEXT_PUBLIC_APP_URL?.trim()
        ? "NEXT_PUBLIC_APP_URL"
        : "fallback localhost",
  });
}

/**
 * POST /api/dev/resend-test
 * Trimite un email de test prin Resend.
 *
 * - În development: fără secret (sau cu RESEND_TEST_SECRET în header).
 * - În production: 404 (dezactivat), decât dacă setezi RESEND_TEST_SECRET și trimiți header-ul
 *   `x-resend-test-secret: <valoarea ta>` (ex. pentru staging).
 */
export async function POST(request: Request) {
  const testSecret = process.env.RESEND_TEST_SECRET?.trim();

  if (process.env.NODE_ENV === "production") {
    if (!testSecret) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const h = request.headers.get("x-resend-test-secret");
    if (h !== testSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (testSecret) {
    const h = request.headers.get("x-resend-test-secret");
    if (h !== testSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: "Lipsește RESEND_API_KEY în .env" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const to = String(body.to ?? process.env.CONTACT_EMAIL ?? "").trim();
  if (!to) {
    return NextResponse.json(
      {
        error:
          'Trimite JSON { "to": "email@exemplu.com" } sau setează CONTACT_EMAIL în .env',
      },
      { status: 400 }
    );
  }

  const r = await sendTestEmail(to);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, from: getResendFromEmail() },
      { status: 502 }
    );
  }

  const base = getPublicAppUrl();
  return NextResponse.json({
    ok: true,
    id: r.id,
    from: getResendFromEmail(),
    to,
    publicBaseUrl: base,
    sampleResetLink: `${base}/reset-password?token=DEMO_TOKEN`,
    sampleVerifyLink: `${base}/verify-email?token=DEMO_TOKEN`,
  });
}
