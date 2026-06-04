"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useCookieConsent, DEFAULT_CONSENT } from "@/contexts/CookieConsentContext";
import { CookieConsentModal } from "./CookieConsentModal";

export function CookieConsentBanner() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { consent, setConsent, hasConsented, consentHydrated } = useCookieConsent();
  /** Pe mobil în `/app`, bara de nav e fixă jos — ridicăm bannerul ca să nu o acopere (md+: nav ascuns). */
  const cookieBottomClass =
    pathname?.startsWith("/app") === true
      ? "bottom-[calc(0.5rem+56px+max(0.5rem,env(safe-area-inset-bottom,0px)))] md:bottom-0"
      : "bottom-0";
  const bannerText = t("cookieConsent.bannerText") as string;
  const acceptLabel = t("cookieConsent.accept") as string;
  const refuseLabel = t("cookieConsent.refuse") as string;
  const preferencesLabel = t("cookieConsent.preferences") as string;

  const acceptAll = () => {
    setConsent({
      necessary: true,
      functional: true,
      statistics: true,
      marketing: true,
    });
  };

  const refuseOptional = () => {
    setConsent({
      ...DEFAULT_CONSENT,
      necessary: true,
      functional: false,
      statistics: false,
      marketing: false,
    });
  };

  if (!consentHydrated) return null;
  if (hasConsented) return null;
  if (
    pathname === "/privacy" ||
    pathname === "/privacy-policy" ||
    pathname === "/cookies" ||
    pathname === "/terms"
  ) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 z-[100] isolate border-t border-dark-600 bg-dark-900 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] ${cookieBottomClass}`}
      role="region"
      aria-label="Cookie consent"
    >
      <div className="mx-auto flex max-w-3xl max-h-[min(48vh,280px)] overflow-y-auto flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:py-3.5">
        <p className="flex-1 text-left text-xs leading-relaxed text-dark-400 sm:text-sm sm:leading-snug">
          {bannerText}{" "}
          <a href="/cookies" className="text-brand-400 underline underline-offset-2 hover:text-brand-300">
            {(t("legal.links.cookies") as string) || "Cookies"}
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-dark-900 transition hover:bg-brand-400 sm:px-4 sm:text-sm"
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            onClick={refuseOptional}
            className="rounded-lg border border-dark-600 px-3 py-2 text-xs font-medium text-dark-300 transition hover:border-dark-500 hover:bg-dark-800 sm:text-sm"
          >
            {refuseLabel}
          </button>
          <CookieConsentPreferencesButton preferencesLabel={preferencesLabel} />
        </div>
      </div>
    </div>
  );
}

function CookieConsentPreferencesButton({ preferencesLabel }: { preferencesLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-3 py-2 text-xs font-medium text-dark-500 underline decoration-dark-600 underline-offset-2 transition hover:text-dark-300 sm:text-sm"
      >
        {preferencesLabel}
      </button>
      {open && (
        <CookieConsentModal
          onClose={() => setOpen(false)}
          onSave={() => setOpen(false)}
        />
      )}
    </>
  );
}
