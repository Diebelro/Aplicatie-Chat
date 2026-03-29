import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  return NextResponse.json({
    planId: user.subscription_plan_id ?? null,
    status: user.subscription_status ?? null,
    currentPeriodEnd: user.subscription_current_period_end ?? null,
    premiumPermanent: user.premium_permanent === true,
  });
}
