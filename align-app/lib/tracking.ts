/**
 * Tracking – trimite evenimente doar daca utilizatorul a dat consent (statistici/marketing).
 * Foloseste localStorage cookie-consent. Apelurile sunt no-op daca nu exista consent.
 */

const STORAGE_KEY = "cookie-consent";

function getConsent(): { statistics?: boolean; marketing?: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      statistics: parsed.statistics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Trimite eveniment catre Google Analytics / dataLayer daca consent.statistics. */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  const consent = getConsent();
  if (!consent?.statistics) return;
  try {
    if (typeof window !== "undefined" && window.dataLayer) {
      window.dataLayer.push({ event: eventName, ...params });
    }
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  } catch {
    // ignore
  }
}

/** Trimite eveniment pentru conversie / reclame daca consent.marketing. */
export function trackConversion(label?: string, value?: number): void {
  const consent = getConsent();
  if (!consent?.marketing) return;
  try {
    if (typeof window !== "undefined" && window.dataLayer) {
      window.dataLayer.push({ event: "conversion", label, value });
    }
  } catch {
    // ignore
  }
}

/** Evenimente specifice: doar daca consent.statistics. */
export const track = {
  view_profile: (profileId: string) => trackEvent("view_profile", { profile_id: profileId }),
  like_sent: (toId: string) => trackEvent("like_sent", { to_id: toId }),
  match_created: (otherId: string) => trackEvent("match_created", { other_id: otherId }),
  message_sent: (toId: string) => trackEvent("message_sent", { to_id: toId }),
  rewarded: () => trackEvent("rewarded", {}),
  subscription: (planId: string) => trackEvent("subscription", { plan_id: planId }),
};
