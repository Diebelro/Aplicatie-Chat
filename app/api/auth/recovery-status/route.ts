import { NextResponse } from "next/server";
import { getRecoveryStatus } from "@/lib/recoverySessions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") ?? "";
    if (!sessionId) {
      return NextResponse.json(
        { error: "Lipsește sessionId." },
        { status: 400 }
      );
    }

    const status = getRecoveryStatus(sessionId);
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json(
      { error: "Eroare la verificare." },
      { status: 500 }
    );
  }
}
