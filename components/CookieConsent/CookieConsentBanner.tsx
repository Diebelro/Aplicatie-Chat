"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useCookieConsent, DEFAULT_CONSENT } from "@/contexts/CookieConsentContext";
import { CookieConsentModal } from "./CookieConsentModal";

export function CookieConsentBanner() {
  const { t } = useI18n();
  const { consent, setConsent, hasConsented } = useCookieConsent();
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

  if (hasConsented || consent !== null) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 bg-dark-800 border-t border-dark-600 shadow-lg rounded-t-2xl"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-4">
        <p className="text-sm text-gray-200 flex-1">{bannerText}</p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={acceptAll}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            onClick={refuseOptional}
            className="px-4 py-2 rounded-xl border border-dark-500 text-gray-300 hover:bg-dark-700 font-medium text-sm transition"
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl border border-dark-500 text-gray-300 hover:bg-dark-700 font-medium text-sm transition"
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
