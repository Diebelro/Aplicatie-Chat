"use client";

import React from "react";
import { I18nProvider } from "@/lib/i18n/context";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CookieConsentBanner } from "@/components/CookieConsent/CookieConsentBanner";
import { CookieConsentFloatingButton } from "@/components/CookieConsent/CookieConsentFloatingButton";
import { TrackingScripts } from "@/components/TrackingScripts";
import { Footer } from "@/components/Footer";
import { AppWebVitalsBeacon } from "@/components/AppWebVitalsBeacon";

/**
 * Fără SessionProvider aici: NextAuth face fetch la /api/auth/session pe tot site-ul și în dev apare
 * CLIENT_FETCH_ERROR (zgomot + confuzie) chiar pentru utilizatorii doar cu login parolă (ex. hartă).
 * SessionProvider e doar în AuthProviders (login/signup).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <CookieConsentProvider>
        <AppWebVitalsBeacon />
        {children}
        <CookieConsentBanner />
        <CookieConsentFloatingButton />
        <TrackingScripts />
        <Footer />
      </CookieConsentProvider>
    </I18nProvider>
  );
}
