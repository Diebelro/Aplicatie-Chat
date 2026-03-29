import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

const PLANS = [
  { id: "monthly", name: "Premium Lunar", priceMonthly: 19.99, interval: "month" as const, features: ["Fără reclame", "Premium 1 lună"] },
  { id: "yearly", name: "Premium Anual", priceMonthly: 15.99, interval: "year" as const, features: ["Fără reclame", "Premium 12 luni", "Economie 20%"] },
  { id: "lifetime", name: "Premium Permanent", priceMonthly: 99.99, interval: "lifetime" as const, features: ["Fără reclame", "Premium permanent"] },
];

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
  return NextResponse.json({ plans: PLANS, current });
}
