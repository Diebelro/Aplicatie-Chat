import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/apiRateLimitGate";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { confirmRecovery } from "@/lib/recoverySessions";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "/api/auth/recovery-confirm");
  if (limited) return limited;
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Trebuie să fii logat pe acest dispozitiv (telefon)." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const qrToken = String(body.qrToken ?? body.token ?? "").trim();
    if (!qrToken) {
      return NextResponse.json(
        { error: "Lipsește token-ul de recuperare." },
        { status: 400 }
      );
    }

    const ok = confirmRecovery(qrToken, userId);
    if (!ok) {
      return NextResponse.json(
        { error: "Link invalid sau expirat. Încearcă din nou de pe calculator." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Eroare la confirmare." },
      { status: 500 }
    );
  }
}
