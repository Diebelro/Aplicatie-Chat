import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { findUserOrPrisma, isPrismaAvailable, prismaUnblockUser } from "@/lib/repo-prisma";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const targetUserId = body?.targetUserId ?? body?.targetId;
  if (!targetUserId || typeof targetUserId !== "string") {
    return NextResponse.json({ error: "Lipsește targetUserId." }, { status: 400 });
  }
  const me = await findUserOrPrisma(userId);
  if (!me) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  if (isPrismaAvailable()) {
    try {
      await prismaUnblockUser(userId, targetUserId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
