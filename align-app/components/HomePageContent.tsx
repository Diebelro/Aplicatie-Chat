"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { getStoredUserRaw } from "@/lib/store";
import { DiebelWordmark } from "@/components/DiebelWordmark";
import { DiebelCopyrightStrip } from "@/components/DiebelAuthorCredit";

/** Landing: aceleași secțiuni ca în app/page.tsx, texte din mesaje (ro / en / de). */
export function HomePageContent() {
  const { t } = useI18n();
  const s = (key: string) => t(key) as string;
  const [ctaHref, setCtaHref] = useState("/signup");

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
    <div className="min-h-dvh flex flex-col bg-dark-900 text-zinc-900 pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="border-b border-dark-600 bg-dark-900/95 backdrop-blur-sm sticky top-0 z-10 supports-[backdrop-filter]:bg-dark-900/80">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="group inline-flex items-center min-h-[44px] min-w-[44px] -ml-1 pl-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900"
            aria-label="Diebel"
          >
            <DiebelWordmark variant="hero" withMark />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link href="/login" className="text-sm font-medium text-dark-500 hover:text-zinc-900 transition">
              {s("home.login")}
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-zinc-900 px-4 py-2 rounded-xl border border-teal-600/20 shadow-sm transition"
            >
              {s("home.signup")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <h1 className="text-4xl md:text-6xl font-bold text-center max-w-3xl mb-6 text-zinc-900 tracking-tight">
          {s("home.headlineBefore")}
          <span className="gradient-text">{s("home.headlineAccent")}</span>
        </h1>
        <p className="text-lg sm:text-xl text-dark-500 text-center max-w-xl mb-12 leading-relaxed">{s("home.subhead")}</p>

        <Link
          href={ctaHref}
          className="bg-brand-500 hover:bg-brand-400 text-zinc-900 font-semibold px-8 py-4 rounded-xl text-lg border border-teal-600/25 shadow-sm transition"
        >
          {s("home.cta")}
        </Link>
      </main>

      <footer className="shrink-0 border-t border-dark-600/70 bg-dark-900/95 px-4 py-4 safe-area-inset-bottom">
        <DiebelCopyrightStrip />
      </footer>
    </div>
  );
}
