"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, Check } from "lucide-react";
import { RewardedPremiumCTA } from "@/components/RewardedPremiumCTA";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";
import { track } from "@/lib/tracking";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  interval: "month" | "six_month" | "year";
  features: string[];
}

export default function PremiumPage() {
  const { tStr, tArray } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ planId: string | null; premiumPermanent: boolean } | null>(null);

  useEffect(() => {
    fetchWithAuthRetry("/api/subscription/plans", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchWithAuthRetry("/api/me/subscription", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setSubscription({
          planId: d.planId ?? null,
          premiumPermanent: d.premiumPermanent === true,
        })
      )
      .catch(() => setSubscription(null));
  }, []);

  const subscribe = (planId: string) => {
    setSubscribing(planId);
    fetchWithAuthRetry("/api/subscription/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSubscription({ planId: d.planId, premiumPermanent: d.planId === "lifetime" });
          track.subscription(d.planId ?? "");
          if (d.planId === "lifetime" && typeof window !== "undefined") {
            const raw = getStoredUserRaw();
            if (raw) {
              try {
                const u = JSON.parse(raw) as User;
                const next = { ...u, premium_permanent: true };
                localStorage.setItem("align_user", JSON.stringify(next));
                sessionStorage.setItem("align_user", JSON.stringify(next));
              } catch {}
            }
          }
        }
      })
      .finally(() => setSubscribing(null));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Crown className="w-8 h-8 text-amber-400" />
        <div>
          <h1 className="app-pro-page-title">{tStr("pages.premium.title")}</h1>
          <p className="app-pro-lead text-dark-400">{tStr("pages.premium.subtitle")}</p>
        </div>
      </div>

      <RewardedPremiumCTA />

      <section>
        <h2 className="app-pro-section-title mb-4">{tStr("pages.premium.sectionPlans")}</h2>
        <p className="app-pro-lead text-dark-400 mb-4">{tStr("pages.premium.plansIntro")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            const locKey = plan.id as "monthly" | "six_month" | "yearly";
            const localizedName = tStr(`pages.subscriptionPlans.${locKey}.name`);
            const localizedDesc = tStr(`pages.subscriptionPlans.${locKey}.description`);
            const localizedFeatures = tArray(`pages.subscriptionPlans.${locKey}.features`);
            const displayName = localizedName || plan.name;
            const displayDescription = localizedDesc || plan.description;
            const displayFeatures =
              localizedFeatures.length > 0 ? localizedFeatures : plan.features;
            const priceLabel =
              plan.interval === "year"
                ? formatTpl(tStr("pages.premium.priceYear"), {
                    amount: (plan.priceMonthly * 12).toFixed(0),
                  })
                : plan.interval === "six_month"
                  ? formatTpl(tStr("pages.premium.priceSixMonth"), {
                      amount: (plan.priceMonthly * 6).toFixed(0),
                    })
                  : formatTpl(tStr("pages.premium.priceMonth"), {
                      amount: String(plan.priceMonthly),
                    });
            return (
              <div
                key={plan.id}
                className="app-pro-panel p-5 flex flex-col shadow-sm"
              >
                <h3 className="font-semibold text-zinc-900 mb-1">{displayName}</h3>
                <p className="text-dark-500 text-sm mb-3">{displayDescription}</p>
                <p className="text-xl font-bold text-zinc-900 mb-4">{priceLabel}</p>
                <ul className="space-y-2 mb-3 flex-1">
                  {displayFeatures.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-dark-300 text-sm">
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-dark-500 text-xs mb-6">{tStr("pages.premium.freeNote")}</p>
                <button
                  type="button"
                  onClick={() => subscribe(plan.id)}
                  disabled={isCurrent || subscribing !== null}
                  className="w-full py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50 bg-brand-500 text-dark-900 hover:bg-brand-400"
                >
                  {isCurrent
                    ? tStr("pages.premium.active")
                    : subscribing === plan.id
                      ? tStr("pages.premium.processing")
                      : tStr("pages.premium.choose")}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-dark-500 text-xs mt-4">{tStr("pages.premium.paymentsNote")}</p>
      </section>

      <p className="text-dark-500 text-sm">
        <Link href="/app/settings/account" className="text-brand-400 hover:underline">
          {tStr("pages.premium.accountLink")}
        </Link>
        {tStr("pages.premium.accountAfter")}
      </p>
    </div>
  );
}
