"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { getStoredUserRaw } from "@/lib/store";
import { DiebelWordmark } from "@/components/DiebelWordmark";
import { DiebelCopyrightStrip } from "@/components/DiebelAuthorCredit";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

/** Landing: aceleași secțiuni ca în app/page.tsx, texte din mesaje (ro / en / de). */
export function HomePageContent() {
  const { t } = useI18n();
  const s = (key: string) => t(key) as string;
  const [ctaHref, setCtaHref] = useState("/signup");
  const { hasConsented, consentHydrated } = useCookieConsent();
  const reserveCookieBanner =
    consentHydrated && !hasConsented
      ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
      : "";

  useEffect(() => {
    let cancelled = false;
    if (getStoredUserRaw()) {
      setCtaHref("/app");
      return;
    }
    void fetch("/api/me", { credentials: "include" })
      .then((r) => (cancelled || !r.ok ? null : r.json()))
      .then((data) => {
        if (cancelled || !data?.user) return;
        setCtaHref("/app");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`min-h-dvh flex flex-col bg-dark-900 text-zinc-900 overflow-x-hidden safe-area-x ${reserveCookieBanner}`}>
      <header className="border-b border-dark-600 bg-dark-900/95 backdrop-blur-sm sticky top-0 z-10 supports-[backdrop-filter]:bg-dark-900/80 safe-area-inset-top shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-3">
          <Link
            href="/"
            className="group inline-flex shrink-0 items-center min-h-[44px] -ml-1 pl-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900"
            aria-label="Diebel"
          >
            <DiebelWordmark variant="header" withMark />
          </Link>
          <nav className="flex min-w-0 shrink items-center gap-2 sm:gap-6">
            <Link
              href="/login"
              className="text-[13px] sm:text-sm font-medium text-dark-500 hover:text-zinc-900 transition whitespace-nowrap"
            >
              {s("home.login")}
            </Link>
            <Link
              href="/signup"
              className="shrink-0 text-[13px] sm:text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-zinc-900 px-3 sm:px-4 py-2 rounded-xl border border-teal-600/20 shadow-sm transition whitespace-nowrap"
            >
              {s("home.signup")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16 min-h-0 w-full">
        <div className="flex flex-col items-center w-full max-w-3xl gap-6 sm:gap-8">
          <h1 className="text-4xl md:text-6xl font-bold text-center text-zinc-900 tracking-tight">
            {s("home.headlineBefore")}
            <span className="gradient-text">{s("home.headlineAccent")}</span>
          </h1>
          <p className="text-lg sm:text-xl text-dark-500 text-center max-w-xl leading-relaxed">{s("home.subhead")}</p>

          <Link
            href={ctaHref}
            className="bg-brand-500 hover:bg-brand-400 text-zinc-900 font-semibold px-8 py-4 rounded-xl text-lg border border-teal-600/25 shadow-sm transition min-h-[48px] inline-flex items-center justify-center touch-manipulation"
          >
            {s("home.cta")}
          </Link>

          <a
            href="https://play.google.com/store/apps/details?id=ro.diebel.chatapp"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-900 px-5 py-3 rounded-xl transition shadow-md hover:shadow-lg touch-manipulation"
            aria-label="Get it on Google Play"
          >
            <svg width="22" height="24" viewBox="0 0 22 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M1.22 0.27C0.91 0.6 0.75 1.1 0.75 1.75V22.25C0.75 22.9 0.91 23.4 1.22 23.73L1.3 23.81L12.57 12.54V12.46L1.3 1.19L1.22 0.27Z" fill="#EA4335"/>
              <path d="M16.42 16.67L12.57 12.82V12.18L16.42 8.33L16.52 8.39L21.1 11.01C22.4 11.75 22.4 12.95 21.1 13.69L16.52 16.61Z" fill="#FBBC04"/>
              <path d="M16.52 16.61L12.57 12.5L1.22 23.73C1.65 24.18 2.36 24.24 3.15 23.79L16.52 16.61Z" fill="#34A853"/>
              <path d="M1.22 0.27L12.57 11.5L16.52 7.39L3.15 0.21C2.36 -0.24 1.65 -0.18 1.22 0.27Z" fill="#4285F4"/>
            </svg>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Get it on</span>
              <span className="text-sm font-semibold text-zinc-900">Google Play</span>
            </div>
          </a>
        </div>
      </main>

      <footer className="shrink-0 mt-auto border-t border-dark-600/70 bg-dark-900/95 px-4 py-3 sm:py-4 safe-area-inset-bottom">
        <DiebelCopyrightStrip />
      </footer>
    </div>
  );
}
