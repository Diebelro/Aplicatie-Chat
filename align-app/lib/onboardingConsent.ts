import { writeAgeGateAccepted } from "@/lib/ageGateStorage";

/** Același key ca în CookieConsentContext. */
export const COOKIE_CONSENT_STORAGE_KEY = "cookie-consent";

export const FULL_COOKIE_CONSENT = {
  necessary: true,
  functional: true,
  statistics: true,
  marketing: true,
} as const;

/** O singură acțiune: 18+ + preferințe cookies (localStorage). */
export function persistFullSiteConsent(): void {
  writeAgeGateAccepted();
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(FULL_COOKIE_CONSENT));
  } catch {
    /* ignore */
  }
}

export function readCookieConsentStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}
