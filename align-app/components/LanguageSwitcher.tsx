"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";

const LABELS: Record<Locale, string> = {
  ro: "RO",
  en: "EN",
  de: "DE",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-xl border border-dark-600 bg-dark-800 p-1">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            locale === loc
              ? "bg-brand-500 text-dark-900"
              : "text-dark-400 hover:text-zinc-900 hover:bg-dark-700"
          }`}
          aria-label={`Switch to ${LABELS[loc]}`}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
