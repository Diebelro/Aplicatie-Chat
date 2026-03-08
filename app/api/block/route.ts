import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { findUserOrPrisma, isPrismaAvailable, prismaBlockUser } from "@/lib/repo-prisma";

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const targetUserId = body?.targetUserId ?? body?.targetId;
  if (!targetUserId || typeof targetUserId !== "string") return NextResponse.json({ error: "Lipsește targetUserId." }, { status: 400 });
  if (targetUserId === userId) return NextResponse.json({ error: "Nu te poți bloca pe tine însuți." }, { status: 400 });
  const me = await findUserOrPrisma(userId);
  if (!me) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  const target = await findUserOrPrisma(targetUserId);
  if (!target) return NextResponse.json({ error: "Utilizatorul țintă nu există." }, { status: 404 });
  if (isPrismaAvailable()) {
    try {
      await prismaBlockUser(userId, targetUserId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
