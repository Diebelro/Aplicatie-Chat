/**
 * Sursă unică pentru planurile Premium afișate în UI (abonamente recurente).
 * Nu include „lifetime” în lista publică — rămâne acceptat doar în API pentru compatibilitate.
 */

export type SubscriptionInterval = "month" | "six_month" | "year";

export interface SubscriptionPlanDefinition {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  /** Stripe Price ID; `null` = nelipsit; `""` = placeholder (ex. plan 6 luni). */
  priceId: string | null;
  interval: SubscriptionInterval;
  features: string[];
}

function envPrice(id: string | undefined): string | null {
  const v = id?.trim();
  return v ? v : null;
}

/** Planuri pentru API public / pagina Premium (fără Permanent). */
export function getPublicSubscriptionPlans(): SubscriptionPlanDefinition[] {
  return [
    {
      id: "monthly",
      name: "Premium Lunar",
      description: "Beneficii extra, plată lunară. Anulare oricând.",
      priceMonthly: 30,
      priceId: envPrice(process.env.STRIPE_PRICE_MONTHLY),
      interval: "month",
      features: [
        "Fără reclame în app (beneficiu extra)",
        "Badge și avantaje Premium",
        "Suport prioritar",
      ],
    },
    {
      id: "six_month",
      name: "Premium 6 luni",
      description: "Beneficii extra pe 6 luni — ofertă intermediară.",
      priceMonthly: 160 / 6,
      priceId: (process.env.STRIPE_PRICE_SIX_MONTH ?? "").trim() || "",
      interval: "six_month",
      features: [
        "Fără reclame în app (beneficiu extra)",
        "Badge și avantaje Premium",
        "Suport prioritar",
      ],
    },
    {
      id: "yearly",
      name: "Premium Anual",
      description: "Beneficii extra pe un an — cel mai avantajos.",
      priceMonthly: 25,
      priceId: envPrice(process.env.STRIPE_PRICE_YEARLY),
      interval: "year",
      features: [
        "Fără reclame în app (beneficiu extra)",
        "Badge și avantaje Premium",
        "Economie față de lunar",
        "Suport prioritar",
      ],
    },
  ];
}

/** ID-uri acceptate la creare / checkout (inclusiv lifetime pentru apeluri vechi). */
export const SUBSCRIPTION_CREATE_PLAN_IDS = ["monthly", "six_month", "yearly", "lifetime"] as const;
