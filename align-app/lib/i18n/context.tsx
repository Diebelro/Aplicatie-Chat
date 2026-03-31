"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { Locale, Translations } from "./types";
import { DEFAULT_LOCALE, LOCALES } from "./types";
import roBootstrap from "@/messages/ro.json";

const STORAGE_KEY = "align-locale";

function loadStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored as Locale)) return stored as Locale;
  } catch {
    // ignore
  }
  return null;
}

function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const lang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage;
  const code = lang?.slice(0, 2).toLowerCase();
  if (code === "en") return "en";
  if (code === "de") return "de";
  if (code === "ro") return "ro";
  return DEFAULT_LOCALE;
}

/** Get nested value by path e.g. "cookieConsent.bannerText". */
function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Get translation by namespace (e.g. t("cookieConsent")) or path (e.g. t("cookieConsent.bannerText")). */
  t: (key: keyof Translations | string) => Translations[keyof Translations] | string;
  translations: Translations | null;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const messageLoaders: Record<Locale, () => Promise<{ default: Translations }>> = {
  ro: () => import("@/messages/ro.json"),
  en: () => import("@/messages/en.json"),
  de: () => import("@/messages/de.json"),
};

async function loadTranslations(locale: Locale): Promise<Translations> {
  const mod = await messageLoaders[locale]();
  return mod.default;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const localeLoadGen = useRef(0);
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [translations, setTranslations] = useState<Translations>(() => roBootstrap as Translations);

  const setLocale = useCallback((newLocale: Locale) => {
    if (newLocale === locale) return;
    const gen = ++localeLoadGen.current;
    loadTranslations(newLocale)
      .then((nextTranslations) => {
        if (gen !== localeLoadGen.current) return;
        setTranslations(nextTranslations);
        setLocaleState(newLocale);
        try {
          localStorage.setItem(STORAGE_KEY, newLocale);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        /* import eșuat — păstrăm limba și mesajele curente */
      });
  }, [locale]);

  useEffect(() => {
    const stored = loadStoredLocale();
    const initial = stored ?? detectBrowserLocale();
    setLocaleState(initial);
    if (initial === "ro") {
      setTranslations(roBootstrap as Translations);
      return;
    }
    const gen = ++localeLoadGen.current;
    loadTranslations(initial)
      .then((tr) => {
        if (gen !== localeLoadGen.current) return;
        setTranslations(tr);
      })
      .catch(() => {
        setLocaleState("ro");
        setTranslations(roBootstrap as Translations);
      });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: keyof Translations | string): Translations[keyof Translations] | string => {
      if (!translations) {
        return typeof key === "string" && key.includes(".") ? "" : ({} as Translations[keyof Translations]);
      }
      if (typeof key === "string" && key.includes(".")) {
        const value = getByPath(translations, key);
        return typeof value === "string" ? value : "";
      }
      return translations[key as keyof Translations];
    },
    [translations]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
