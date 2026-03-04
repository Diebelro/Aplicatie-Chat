import { NextRequest, NextResponse } from "next/server";
import { findUserById, getMissedCalls, clearMissedCalls } from "@/lib/store";

/** Lista apeluri pierdute pentru utilizatorul curent. */
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const list = getMissedCalls(userId);
  const missed = list.map((m) => {
    const from = findUserById(m.fromId);
    return {
      fromId: m.fromId,
      fromName: from?.name ?? "Cineva",
      at: m.at,
      audioOnly: m.audioOnly,
    };
  });
  return NextResponse.json({ missed });
}

/** Șterge lista de apeluri pierdute. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  clearMissedCalls(userId);
  return NextResponse.json({ ok: true });
}
