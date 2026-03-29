import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { getPublicSubscriptionPlans } from "@/lib/subscriptionPlans";

/** GET /api/subscriptions – planuri disponibile + abonamentul curent al utilizatorului (dacă e autentificat). */
export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  let current = null;
  if (userId) {
    const user = findUserById(userId);
    if (user) {
      current = {
        planId: user.subscription_plan_id ?? null,
        status: user.subscription_status ?? null,
        currentPeriodEnd: user.subscription_current_period_end ?? null,
        premiumPermanent: user.premium_permanent === true,
      };
    }
  }
  const plans = getPublicSubscriptionPlans().map(({ id, name, priceMonthly, interval, features }) => ({
    id,
    name,
    priceMonthly,
    interval,
    features,
  }));
  return NextResponse.json({ plans, current });
}
