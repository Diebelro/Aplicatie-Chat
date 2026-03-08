import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaGetMessagesBetween, prismaCreateAdminLog, findUserOrPrisma } from "@/lib/repo-prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  const { id } = await params;
  const parts = id.split("_");
  if (parts.length !== 2) return NextResponse.json({ error: "ID invalid (userId1_userId2)." }, { status: 400 });
  const [userAId, userBId] = parts;
  try {
    const messages = await prismaGetMessagesBetween(userAId, userBId);
    const userA = await findUserOrPrisma(userAId);
    const userB = await findUserOrPrisma(userBId);
    await prismaCreateAdminLog(userId, "VIEW_CONVERSATION", id);
    return NextResponse.json({ messages, userA: userA ? { id: userA.id, name: userA.name, email: userA.email } : null, userB: userB ? { id: userB.id, name: userB.name, email: userB.email } : null });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
