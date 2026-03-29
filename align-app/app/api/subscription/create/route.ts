import { NextRequest, NextResponse } from "next/server";
import { findUserById, updateUser } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, findUserOrPrisma, prismaActivatePremiumDemo } from "@/lib/repo-prisma";
import { recordApiRouteError } from "@/lib/serverErrorRing";
import { SUBSCRIPTION_CREATE_PLAN_IDS } from "@/lib/subscriptionPlans";

/** Stub: creează sesiune checkout sau marchează planul. În producție integrezi Stripe/plata. */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
    }
    const user = await findUserOrPrisma(userId);
    if (!user) {
      return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const planId = body?.planId ?? body?.plan_id;
    if (!planId || typeof planId !== "string") {
      return NextResponse.json(
        { error: "Lipsește planId (monthly, six_month, yearly, lifetime)." },
        { status: 400 }
      );
    }
    const validPlans: string[] = [...SUBSCRIPTION_CREATE_PLAN_IDS];
    if (!validPlans.includes(planId)) {
      return NextResponse.json({ error: "Plan invalid." }, { status: 400 });
    }

    if (planId === "lifetime") {
      if (isPrismaAvailable()) {
        await prismaActivatePremiumDemo(userId, "lifetime", null);
      } else {
        updateUser(userId, {
          premium_permanent: true,
          subscription_plan_id: "lifetime",
          subscription_status: "active",
          subscription_current_period_end: null,
        });
      }
      return NextResponse.json({
        ok: true,
        message: "Premium permanent activat (demo).",
        planId: "lifetime",
      });
    }

    const periodEnd = new Date();
    if (planId === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else if (planId === "six_month") periodEnd.setMonth(periodEnd.getMonth() + 6);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (isPrismaAvailable()) {
      await prismaActivatePremiumDemo(userId, planId, periodEnd);
    } else {
      updateUser(userId, {
        premium_until: periodEnd.getTime(),
        subscription_plan_id: planId,
        subscription_status: "active",
        subscription_current_period_end: periodEnd.toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Abonament activat (demo, fără plată).",
      planId,
      currentPeriodEnd: periodEnd.toISOString(),
      checkoutUrl: null,
    });
  } catch (e) {
    recordApiRouteError("POST /api/subscription/create", e);
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
