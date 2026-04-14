"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { CookieConsentModal } from "./CookieConsentModal";

/**
 * Buton discret doar după ce utilizatorul și-a exprimat deja preferințele.
 * Înainte de asta, bara de jos (CookieConsentBanner) e suficientă — fără dubluri.
 */
export function CookieConsentFloatingButton() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { hasConsented } = useCookieConsent();
  const settingsLabel = t("cookieConsent.settingsButton") as string;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!hasConsented) return null;

  const appMobileNavClear =
    pathname?.startsWith("/app") === true
      ? "max-md:bottom-[calc(0.75rem+0.5rem+56px+max(0.5rem,env(safe-area-inset-bottom,0px)))]"
      : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 z-[10040] flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-dark-600 bg-dark-800 text-dark-400 shadow-lg transition hover:border-dark-500 hover:text-dark-200 ${appMobileNavClear}`}
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
