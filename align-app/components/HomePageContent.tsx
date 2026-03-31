"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

/** Landing: aceleași secțiuni ca în app/page.tsx, texte din mesaje (ro / en / de). */
export function HomePageContent() {
  const { t } = useI18n();
  const s = (key: string) => t(key) as string;

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-zinc-900">
      <header className="border-b border-dark-600 bg-dark-900/95 backdrop-blur-sm sticky top-0 z-10 supports-[backdrop-filter]:bg-dark-900/80">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight gradient-text">Align</span>
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
          href="/signup"
          className="bg-brand-500 hover:bg-brand-400 text-zinc-900 font-semibold px-8 py-4 rounded-xl text-lg border border-teal-600/25 shadow-sm transition"
        >
          {s("home.cta")}
        </Link>
      </main>
    </div>
  );
}
