"use client";

import React from "react";
import { I18nProvider } from "@/lib/i18n/context";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CookieConsentBanner } from "@/components/CookieConsent/CookieConsentBanner";
import { CookieConsentFloatingButton } from "@/components/CookieConsent/CookieConsentFloatingButton";
import { TrackingScripts } from "@/components/TrackingScripts";
import { Footer } from "@/components/Footer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <CookieConsentProvider>
        {children}
        <CookieConsentBanner />
        <CookieConsentFloatingButton />
        <TrackingScripts />
        <Footer />
      </CookieConsentProvider>
    </I18nProvider>
  );
}
