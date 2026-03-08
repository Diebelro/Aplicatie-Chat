import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { findUserOrPrisma, isPrismaAvailable, prismaDeleteMatchById } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const matchId = body?.matchId;
  if (!matchId || typeof matchId !== "string") {
    return NextResponse.json({ error: "Lipsește matchId." }, { status: 400 });
  }
  const me = await findUserOrPrisma(userId);
  if (!me) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  if (isPrismaAvailable()) {
    try {
      const m = await prisma.match.findUnique({ where: { id: matchId } });
      if (!m) {
        return NextResponse.json({ error: "Match negăsit." }, { status: 404 });
      }
      if (m.userAId !== userId && m.userBId !== userId) {
        return NextResponse.json({ error: "Nu ai dreptul să anulezi acest match." }, { status: 403 });
      }
      await prismaDeleteMatchById(matchId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
