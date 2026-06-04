"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { AGE_GATE_STORAGE_KEY } from "@/lib/ageGateStorage";
import { persistFullSiteConsent, readCookieConsentStored } from "@/lib/onboardingConsent";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

/**
 * Prima deschidere: confirmare 18+ înainte de utilizarea site-ului / TWA / PWA.
 * Nu blochează /admin (panou intern).
 */
const AUTH_PATHS_NO_GATE = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/reset-password-via-scan",
]);

export function AgeGate() {
  const pathname = usePathname() ?? "";
  const { tStr } = useI18n();
  const { setConsent, loadConsent } = useCookieConsent();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || pathname.startsWith("/admin") || AUTH_PATHS_NO_GATE.has(pathname)) {
      setOpen(false);
      return;
    }
    try {
      const needsAge = typeof window !== "undefined" && localStorage.getItem(AGE_GATE_STORAGE_KEY) !== "1";
      const needsCookies = !readCookieConsentStored();
      setOpen(needsAge || needsCookies);
    } catch {
      setOpen(true);
    }
  }, [mounted, pathname]);

  const onAccept = useCallback(() => {
    persistFullSiteConsent();
    setConsent({
      necessary: true,
      functional: true,
      statistics: true,
      marketing: true,
    });
    loadConsent();
    setOpen(false);
  }, [setConsent, loadConsent]);

  const onDecline = useCallback(() => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        window.location.href = "about:blank";
      } catch {
        /* ignore */
      }
    }, 150);
  }, []);

  if (!mounted || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-dark-950/98 backdrop-blur-md px-4 py-8 safe-area-inset-top safe-area-inset-bottom"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-desc1 age-gate-desc2"
    >
      <div className="w-full max-w-md rounded-2xl border border-dark-600 bg-dark-900 shadow-xl p-6 sm:p-8 space-y-5">
        <h1 id="age-gate-title" className="text-lg sm:text-xl font-semibold text-zinc-100 text-center leading-snug">
          {tStr("pages.ageGate.title")}
        </h1>
        <p id="age-gate-desc1" className="text-sm text-dark-300 text-center leading-relaxed">
          {tStr("pages.ageGate.bodyLine1")}
        </p>
        <p id="age-gate-desc2" className="text-sm text-dark-400 text-center leading-relaxed">
          {tStr("pages.ageGate.bodyLine2")}
        </p>
        <p className="text-center text-xs">
          <Link href="/community-rules" className="text-brand-400 hover:underline font-medium">
            {tStr("pages.ageGate.linkRules")}
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 min-h-11 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold text-sm transition"
          >
            {tStr("pages.ageGate.accept")}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 min-h-11 rounded-xl border border-dark-500 bg-dark-800 text-dark-300 hover:bg-dark-700 font-medium text-sm transition"
          >
            {tStr("pages.ageGate.decline")}
          </button>
        </div>
        <p className="text-[11px] text-dark-500 text-center leading-relaxed">{tStr("pages.ageGate.declineHint")}</p>
      </div>
    </div>
  );
}
