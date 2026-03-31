"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Locale, Translations } from "./types";
import { DEFAULT_LOCALE, LOCALES } from "./types";
import { detectBrowserLocale } from "./intlLocale";
import roBootstrap from "@/messages/ro.json";

/**
 * Limba aleasă explicit de utilizator (LanguageSwitcher). Nu scriem această cheie la detectare automată din browser —
 * astfel, la fiecare vizită fără preferință salvată, UI urmează limba mediului (navigator.languages).
 */
const USER_CHOICE_STORAGE_KEY = "align-locale";

function loadUserChosenLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(USER_CHOICE_STORAGE_KEY);
    if (stored && LOCALES.includes(stored as Locale)) return stored as Locale;
  } catch {
    // ignore
  }
  return null;
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
  /** Doar frunze string din JSON (ex. `appNav.messages`, `legal.links.terms`) — pentru UI fără asertări. */
  tStr: (path: string) => string;
  /** Frunze `string[]` din JSON (ex. lista de features Premium). */
  tArray: (path: string) => string[];
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

/** Panoul /admin rămâne doar în română (fără en/de în context); preferința utilizatorului se păstrază în afara admin. */
function I18nProviderShell({
  locale,
  setLocale,
  translations,
  children,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  translations: Translations | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const activeTranslations = isAdminRoute ? (roBootstrap as Translations) : (translations ?? (roBootstrap as Translations));
  const activeLocale: Locale = isAdminRoute ? "ro" : locale;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = activeLocale;
    }
  }, [activeLocale]);

  const t = useCallback(
    (key: keyof Translations | string): Translations[keyof Translations] | string => {
      if (!activeTranslations) {
        return typeof key === "string" && key.includes(".") ? "" : ({} as Translations[keyof Translations]);
      }
      if (typeof key === "string" && key.includes(".")) {
        const value = getByPath(activeTranslations, key);
        return typeof value === "string" ? value : "";
      }
      return activeTranslations[key as keyof Translations];
    },
    [activeTranslations]
  );

  const tStr = useCallback(
    (path: string): string => {
      if (!activeTranslations) return "";
      const value = getByPath(activeTranslations, path);
      return typeof value === "string" ? value : "";
    },
    [activeTranslations]
  );

  const tArray = useCallback((path: string): string[] => {
    if (!activeTranslations) return [];
    const value = getByPath(activeTranslations, path);
    if (!Array.isArray(value)) return [];
    return value.filter((x): x is string => typeof x === "string");
  }, [activeTranslations]);

  return (
    <I18nContext.Provider
      value={{ locale: activeLocale, setLocale, t, tStr, tArray, translations: activeTranslations }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const localeLoadGen = useRef(0);
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [translations, setTranslations] = useState<Translations>(() => roBootstrap as Translations);

  /** Doar din LanguageSwitcher: persistă preferința utilizatorului. */
  const setLocale = useCallback((newLocale: Locale) => {
    if (newLocale === locale) return;
    const gen = ++localeLoadGen.current;
    loadTranslations(newLocale)
      .then((nextTranslations) => {
        if (gen !== localeLoadGen.current) return;
        setTranslations(nextTranslations);
        setLocaleState(newLocale);
        try {
          localStorage.setItem(USER_CHOICE_STORAGE_KEY, newLocale);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        /* import eșuat — păstrăm limba și mesajele curente */
      });
  }, [locale]);

  useEffect(() => {
    const userChoice = loadUserChosenLocale();
    const initial = userChoice ?? detectBrowserLocale();
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

  return (
    <I18nProviderShell locale={locale} setLocale={setLocale} translations={translations}>
      {children}
    </I18nProviderShell>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
