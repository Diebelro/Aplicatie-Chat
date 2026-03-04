"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { CookieConsentModal } from "./CookieConsentModal";

export function CookieConsentFloatingButton() {
  const { t } = useI18n();
  const settingsLabel = t("cookieConsent.settingsButton") as string;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-[99] px-4 py-2 rounded-xl bg-dark-700 border border-dark-600 text-gray-300 hover:bg-dark-600 hover:text-white font-medium text-sm shadow-lg transition"
        aria-label={settingsLabel}
      >
        {settingsLabel}
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
