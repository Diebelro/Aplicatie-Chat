import { NextResponse } from "next/server";
import { isPrismaAvailable, prismaCompleteEmailVerification } from "@/lib/repo-prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Lipsește token-ul." }, { status: 400 });
    }
    if (!isPrismaAvailable()) {
      return NextResponse.json(
        { error: "Verificarea email necesită baza de date (DATABASE_URL)." },
        { status: 503 }
      );
    }
    const ok = await prismaCompleteEmailVerification(token);
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "Link invalid sau expirat. Folosește „Retrimite link verificare” sau înregistrează-te din nou.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json({ error: "Eroare la verificare." }, { status: 500 });
  }
}
