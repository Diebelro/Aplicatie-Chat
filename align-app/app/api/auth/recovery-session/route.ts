import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/apiRateLimitGate";
import { createRecoverySession } from "@/lib/recoverySessions";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "/api/auth/recovery-session");
  if (limited) return limited;
  try {
    const { sessionId, qrToken } = createRecoverySession();
    return NextResponse.json({ sessionId, qrToken });
  } catch {
    return NextResponse.json(
      { error: "Eroare la crearea sesiunii de recuperare." },
      { status: 500 }
    );
  }
}
