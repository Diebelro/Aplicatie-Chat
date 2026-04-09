import { NextRequest, NextResponse } from "next/server";
import { findUserOrPrisma } from "@/lib/repo-prisma";
import { callApiCallerUserExists } from "@/lib/callCallerExists";
import { findUserById, getMissedCalls, clearMissedCalls } from "@/lib/store";

/** Lista apeluri pierdute pentru utilizatorul curent. */
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!(await callApiCallerUserExists(userId))) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const list = getMissedCalls(userId);
  const missed = await Promise.all(
    list.map(async (m) => {
      const from = await findUserOrPrisma(m.fromId);
      const fromUser = from ?? findUserById(m.fromId);
      return {
        fromId: m.fromId,
        fromName: fromUser?.name ?? fromUser?.username ?? "Cineva",
        at: m.at,
        audioOnly: m.audioOnly,
      };
    })
  );
  return NextResponse.json({ missed });
}

/** Șterge lista de apeluri pierdute. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!(await callApiCallerUserExists(userId))) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  clearMissedCalls(userId);
  return NextResponse.json({ ok: true });
}
