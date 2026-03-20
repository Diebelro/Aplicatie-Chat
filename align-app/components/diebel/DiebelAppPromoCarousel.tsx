"use client";

import { useEffect, useState } from "react";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";
import { DiebelBannerCarousel } from "./DiebelBannerCarousel";

function isPremiumUser(user: User): boolean {
  if (user.premium_permanent) return true;
  const until = user.premium_until;
  if (until != null && typeof until === "number" && Date.now() < until) return true;
  return false;
}

export type DiebelAppPromoCarouselProps = {
  /** Dacă true, ascunde promo pentru utilizatori Premium (ca la AdSlot). Implicit true. */
  hideIfPremium?: boolean;
  /** Layout îngust în cardul feed (Descoperă). */
  compact?: boolean;
};

/**
 * Înlocuiește slot-ul de publicitate: carousel DIEBEL în app (/app/profiles, feed).
 * Nu cere consent marketing — e promo first-party DIEBEL.
 */
export function DiebelAppPromoCarousel({
  hideIfPremium = true,
  compact = false,
}: DiebelAppPromoCarouselProps) {
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    const raw = getStoredUserRaw();
    if (!raw) {
      setPremium(false);
      return;
    }
    try {
      setPremium(isPremiumUser(JSON.parse(raw) as User));
    } catch {
      setPremium(false);
    }
  }, []);

  if (hideIfPremium && premium) return null;

  return (
    <div className={`w-full flex justify-center ${compact ? "py-1" : "py-2"}`}>
      <DiebelBannerCarousel
        compact={compact}
        autoRotate
        intervalMs={4000}
        showDots
        className="w-full"
      />
    </div>
  );
}
