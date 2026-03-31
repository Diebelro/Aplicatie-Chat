"use client";

import { useState, useEffect } from "react";
import { Gift } from "lucide-react";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";
import { track } from "@/lib/tracking";
import { getAuthHeaders } from "@/lib/authClient";

interface PremiumState {
  premium: boolean;
  premiumUntil: number | null;
  canActivateRewarded: boolean;
  rewardedActivationsToday: number;
  rewardedActivationsMax: number;
}

export function RewardedPremiumCTA() {
  const [state, setState] = useState<PremiumState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/premium", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setState({
          premium: d.premium ?? false,
          premiumUntil: d.premiumUntil ?? null,
          canActivateRewarded: d.canActivateRewarded ?? false,
          rewardedActivationsToday: d.rewardedActivationsToday ?? 0,
          rewardedActivationsMax: d.rewardedActivationsMax ?? 3,
        });
      })
      .catch(() => setState(null))
      .finally(() => setLoading(false));
  }, []);

  const activateRewarded = () => {
    if (!state?.canActivateRewarded || activating) return;
    setActivating(true);
    setMessage(null);
    // Simulare: utilizatorul "urmareste" reclama (pe web nu avem AdMob rewarded, deci activam direct dupa confirmare)
    const confirmed = typeof window !== "undefined" && window.confirm(
      "Urmărești o reclamă scurtă pentru 1 oră de Premium fără reclame. Continui?"
    );
    if (!confirmed) {
      setActivating(false);
      return;
    }
    fetch("/api/rewarded", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setMessage(d.error);
          return;
        }
        setState((prev) =>
          prev
            ? {
                ...prev,
                premium: true,
                premiumUntil: d.premiumUntil ?? null,
                canActivateRewarded: (d.activationsLeft ?? 0) > 0,
                rewardedActivationsToday: prev.rewardedActivationsMax - (d.activationsLeft ?? 0),
              }
            : null
        );
        setMessage("Premium activ 1 ora!");
        track.rewarded();
        const raw = getStoredUserRaw();
        if (raw) {
          try {
            const u = JSON.parse(raw) as User;
            const next = { ...u, premium_until: d.premiumUntil };
            localStorage.setItem("align_user", JSON.stringify(next));
            sessionStorage.setItem("align_user", JSON.stringify(next));
          } catch {}
        }
      })
      .catch(() => setMessage("Eroare. Incearca din nou."))
      .finally(() => setActivating(false));
  };

  if (loading || !state) return null;
  if (state.premium) {
    const end = state.premiumUntil ? new Date(state.premiumUntil) : null;
    return (
      <div className="rounded-xl bg-brand-500/20 border border-brand-500/40 px-4 py-2 flex items-center gap-2 text-brand-300 text-sm">
        <Gift className="w-4 h-4 shrink-0" />
        <span>
          Premium activ
          {end ? ` pana la ${end.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}` : " (permanent)"}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-dark-800 border border-dark-600 p-4">
      <div className="flex items-center gap-2 text-zinc-900 font-medium mb-1">
        <Gift className="w-5 h-5 text-amber-400" />
        Premium 1 ora – Urmărește o reclamă
      </div>
      <p className="text-dark-400 text-sm mb-3">
        Ai {state.rewardedActivationsToday}/{state.rewardedActivationsMax} activări astăzi. Urmărește o reclamă scurtă pentru 1 oră fără reclame.
      </p>
      {message && <p className="text-sm mb-2 text-brand-400">{message}</p>}
      <button
        type="button"
        onClick={activateRewarded}
        disabled={!state.canActivateRewarded || activating}
        className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30 disabled:opacity-50 transition text-sm font-medium"
      >
        {activating ? "Se activeaza..." : "Activeaza Premium 1h"}
      </button>
    </div>
  );
}
