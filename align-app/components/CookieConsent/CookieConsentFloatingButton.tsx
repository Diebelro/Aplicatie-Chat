"use client";

import React, { useState } from "react";
import { Cookie } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { CookieConsentModal } from "./CookieConsentModal";

/**
 * Buton discret doar după ce utilizatorul și-a exprimat deja preferințele.
 * Înainte de asta, bara de jos (CookieConsentBanner) e suficientă — fără dubluri.
 */
export function CookieConsentFloatingButton() {
  const { t } = useI18n();
  const { hasConsented } = useCookieConsent();
  const settingsLabel = t("cookieConsent.settingsButton") as string;
  const [open, setOpen] = useState(false);

  if (!hasConsented) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[99] flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-dark-800/90 text-dark-400 shadow-lg backdrop-blur-sm transition hover:border-dark-500 hover:text-dark-200"
        aria-label={settingsLabel}
        title={settingsLabel}
      >
        <Cookie className="h-4 w-4" aria-hidden />
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
