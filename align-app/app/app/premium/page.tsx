"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, Gift, Check } from "lucide-react";
import { RewardedPremiumCTA } from "@/components/RewardedPremiumCTA";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";
import { track } from "@/lib/tracking";
import { getAuthHeaders } from "@/lib/authClient";

interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  interval: string;
  features: string[];
}

export default function PremiumPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ planId: string | null; premiumPermanent: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/subscription/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/me/subscription", { headers: getAuthHeaders() })
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
    fetch("/api/subscription/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
          <h1 className="text-2xl font-bold text-white">Premium</h1>
          <p className="text-dark-400 text-sm">Fara reclame, beneficii exclusive.</p>
        </div>
      </div>

      <RewardedPremiumCTA />

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Abonamente</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            const isLifetime = plan.id === "lifetime";
            const priceLabel =
              plan.interval === "lifetime"
                ? `${plan.priceMonthly} RON (o singura data)`
                : plan.interval === "year"
                  ? `${(plan.priceMonthly * 12).toFixed(0)} RON / an`
                  : `${plan.priceMonthly} RON / luna`;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-5 flex flex-col ${
                  isLifetime ? "border-amber-500/50 bg-amber-500/5" : "border-dark-600 bg-dark-800"
                }`}
              >
                <h3 className="font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-dark-500 text-sm mb-3">{plan.description}</p>
                <p className="text-xl font-bold text-white mb-4">{priceLabel}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-dark-300 text-sm">
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => subscribe(plan.id)}
                  disabled={isCurrent || subscribing !== null}
                  className="w-full py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50 bg-brand-500 text-dark-900 hover:bg-brand-400"
                >
                  {isCurrent ? "Activ" : subscribing === plan.id ? "Se proceseaza..." : "Alege"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-dark-500 text-xs mt-4">
          Platile sunt procesate in siguranta. Poti anula abonamentul oricand din Setari cont.
        </p>
      </section>

      <p className="text-dark-500 text-sm">
        <Link href="/app/settings/account" className="text-brand-400 hover:underline">
          Setari cont
        </Link>{" "}
        – gestioneaza abonamentul si datele.
      </p>
    </div>
  );
}
