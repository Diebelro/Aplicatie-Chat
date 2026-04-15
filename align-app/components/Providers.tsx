"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n/context";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CookieConsentBanner } from "@/components/CookieConsent/CookieConsentBanner";
import { CookieConsentFloatingButton } from "@/components/CookieConsent/CookieConsentFloatingButton";
import { TrackingScripts } from "@/components/TrackingScripts";
import { Footer } from "@/components/Footer";
import { AppWebVitalsBeacon } from "@/components/AppWebVitalsBeacon";
import { InLucruBanner } from "@/components/InLucruBanner";

function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  if (pathname?.startsWith("/app")) return null;
  return <Footer />;
}

/**
 * SessionProvider la root: `signOut()` din /app, cookie JWT NextAuth, fără refetch agresiv.
 * (refetchInterval 0 + refetchOnWindowFocus false limitează cererile la /api/auth/session.)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <CookieConsentProvider>
        <SessionProvider basePath="/api/auth" refetchOnWindowFocus={false} refetchInterval={0}>
          {process.env.NEXT_PUBLIC_SHOW_WIP_BANNER === "true" ? <InLucruBanner /> : null}
          <AppWebVitalsBeacon />
          {children}
          <CookieConsentBanner />
          <CookieConsentFloatingButton />
          <TrackingScripts />
          <SiteFooter />
        </SessionProvider>
      </CookieConsentProvider>
    </I18nProvider>
  );
}
