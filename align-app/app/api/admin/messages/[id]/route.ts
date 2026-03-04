import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaCreateAdminLog } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  const { id: messageId } = await params;
  try {
    await prisma.message.delete({ where: { id: messageId } });
    await prismaCreateAdminLog(userId, "DELETE_MESSAGE", messageId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Mesaj negăsit." }, { status: 500 });
  }
}
