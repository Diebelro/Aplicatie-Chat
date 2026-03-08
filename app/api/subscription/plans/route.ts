import { NextResponse } from "next/server";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceId: string | null;
  interval: "month" | "year" | "lifetime";
  features: string[];
}

const PLANS: SubscriptionPlan[] = [
  {
    id: "monthly",
    name: "Premium Lunar",
    description: "Acces Premium lunar, anulare oricand.",
    priceMonthly: 19.99,
    priceId: process.env.STRIPE_PRICE_MONTHLY ?? null,
    interval: "month",
    features: ["Fara reclame", "Premium 1 luna", "Suport prioritar"],
  },
  {
    id: "yearly",
    name: "Premium Anual",
    description: "Cel mai avantajos – economisesti 2 luni.",
    priceMonthly: 15.99,
    priceId: process.env.STRIPE_PRICE_YEARLY ?? null,
    interval: "year",
    features: ["Fara reclame", "Premium 12 luni", "Economie 20%", "Suport prioritar"],
  },
  {
    id: "lifetime",
    name: "Premium Permanent",
    description: "Un singur platit, Premium pentru totdeauna.",
    priceMonthly: 99.99,
    priceId: process.env.STRIPE_PRICE_LIFETIME ?? null,
    interval: "lifetime",
    features: ["Fara reclame", "Premium permanent", "Suport prioritar"],
  },
];

export async function GET() {
  return NextResponse.json({ plans: PLANS });
}
