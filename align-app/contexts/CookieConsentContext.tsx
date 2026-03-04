"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cookie-consent";

export interface CookieConsentState {
  necessary: boolean;
  functional: boolean;
  statistics: boolean;
  marketing: boolean;
}

const DEFAULT_CONSENT: CookieConsentState = {
  necessary: true,
  functional: false,
  statistics: false,
  marketing: false,
};

type ConsentState = CookieConsentState | null;

interface CookieConsentContextValue {
  consent: ConsentState;
  setConsent: (value: CookieConsentState) => void;
  loadConsent: () => void;
  hasConsented: boolean;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function loadStoredConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (
      typeof parsed.necessary === "boolean" &&
      typeof parsed.functional === "boolean" &&
      typeof parsed.statistics === "boolean" &&
      typeof parsed.marketing === "boolean"
    ) {
      return { ...DEFAULT_CONSENT, ...parsed, necessary: true };
    }
  } catch {
    // ignore
  }
  return null;
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<ConsentState>(null);

  const loadConsent = useCallback(() => {
    setConsentState(loadStoredConsent());
  }, []);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  const setConsent = useCallback((value: CookieConsentState) => {
    const stored = { ...value, necessary: true };
    setConsentState(stored);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // ignore
    }
  }, []);

  const hasConsented = consent !== null;

  return (
    <CookieConsentContext.Provider
      value={{ consent, setConsent, loadConsent, hasConsented }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return ctx;
}

export { DEFAULT_CONSENT };
