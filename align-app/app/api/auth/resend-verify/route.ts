import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/appUrl";
import { sendEmailVerificationEmail } from "@/lib/email";
import {
  isPrismaAvailable,
  prismaResendEmailVerification,
} from "@/lib/repo-prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Lipsește token-ul din link." }, { status: 400 });
    }
    if (!isPrismaAvailable()) {
      return NextResponse.json(
        { error: "Retrimiterea necesită baza de date (DATABASE_URL)." },
        { status: 503 }
      );
    }
    const result = await prismaResendEmailVerification(token);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "Nu putem retrimite: link necunoscut, cont deja verificat sau token șters. Înregistrează-te din nou.",
        },
        { status: 400 }
      );
    }
    const verifyLink = `${getPublicAppUrl()}/verify-email?token=${encodeURIComponent(result.token)}`;
    const sent = await sendEmailVerificationEmail({
      to: result.email,
      verifyLink,
    });
    if (!sent) {
      return NextResponse.json(
        {
          error:
            "Emailul nu s-a putut trimite. Verifică RESEND_API_KEY, RESEND_FROM_EMAIL și că diebel.ro e Verified în Resend.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-verify]", err);
    return NextResponse.json({ error: "Eroare la retrimitere." }, { status: 500 });
  }
}
