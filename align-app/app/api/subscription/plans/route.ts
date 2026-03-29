import { NextResponse } from "next/server";
import {
  getPublicSubscriptionPlans,
  type SubscriptionInterval,
  type SubscriptionPlanDefinition,
} from "@/lib/subscriptionPlans";

export type { SubscriptionPlanDefinition as SubscriptionPlan, SubscriptionInterval };

export async function GET() {
  return NextResponse.json({ plans: getPublicSubscriptionPlans() });
}
