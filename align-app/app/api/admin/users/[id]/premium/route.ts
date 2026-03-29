import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  findUserOrPrisma,
  isPrismaAvailable,
  prismaGetUserRole,
  prismaCreateAdminLog,
  prismaActivatePremiumDemo,
} from "@/lib/repo-prisma";

async function requireAdmin(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  return { userId };
}

/** Acordă Premium gratuit: type = "lifetime" (nelimitat) sau "trial" (days zile). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: targetId } = await params;
  const body = await request.json().catch(() => ({}));
  const type = body?.type;
  if (type !== "lifetime" && type !== "trial") {
    return NextResponse.json(
      { error: 'Lipsește type: "lifetime" (gratuit nelimitat) sau "trial" (cu days).' },
      { status: 400 }
    );
  }
  const target = await findUserOrPrisma(targetId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });

  let planId: string;
  let currentPeriodEnd: Date | null = null;
  if (type === "lifetime") {
    planId = "admin_gift";
  } else {
    const days = Math.min(3650, Math.max(1, Number(body?.days) || 30));
    planId = "admin_trial";
    currentPeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  try {
    await prismaActivatePremiumDemo(targetId, planId, currentPeriodEnd);
    await prismaCreateAdminLog(
      auth.userId,
      type === "lifetime" ? "GRANT_PREMIUM_LIFETIME" : "GRANT_PREMIUM_TRIAL",
      targetId
    );
    return NextResponse.json({ ok: true, planId, currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
