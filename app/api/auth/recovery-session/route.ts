import { NextResponse } from "next/server";
import { createRecoverySession } from "@/lib/recoverySessions";

export async function POST() {
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
