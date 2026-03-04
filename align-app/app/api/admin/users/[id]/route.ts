import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { findUserOrPrisma, isPrismaAvailable, prismaGetUserRole, prismaCreateAdminLog, prismaGetPremiumSubscription } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthenticatedUserId(_r);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  const { id } = await params;
  const user = await findUserOrPrisma(id);
  if (!user) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  const premium = await prismaGetPremiumSubscription(id);
  const premiumUntil = premium?.currentPeriodEnd && premium.status === "active"
    ? premium.currentPeriodEnd.toISOString()
    : null;
  return NextResponse.json({
    user,
    premium: premium ? { active: premium.status === "active", planId: premium.planId, premiumUntil } : { active: false, planId: null, premiumUntil: null },
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  const { id: targetId } = await params;
  if (targetId === userId) return NextResponse.json({ error: "Nu te poți șterge." }, { status: 400 });
  const target = await findUserOrPrisma(targetId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  try {
    await prisma.user.delete({ where: { id: targetId } });
    await prismaCreateAdminLog(userId, "DELETE_USER", targetId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
