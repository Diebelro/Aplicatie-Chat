"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { getTermsContent } from "@/lib/i18n/legalContent";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Footer } from "@/components/Footer";

export default function TermsPage() {
  const { locale, t } = useI18n();
  const legal = t("legal") as { termsTitle: string };
  const sections = getTermsContent(locale);

  return (
    <div className="min-h-screen flex flex-col bg-dark-900">
      <header className="border-b border-dark-600 sticky top-0 bg-dark-900/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-brand-400 hover:text-brand-300">
            Align
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <p className="text-dark-400 text-sm mb-4">
          {String(t("legal.relatedDocs"))}{" "}
          <Link href="/privacy" className="text-brand-400 hover:underline">
            {String(t("legal.links.privacy"))}
          </Link>
          {" · "}
          <Link href="/cookies" className="text-brand-400 hover:underline">
            {String(t("legal.links.cookies"))}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-8">{legal.termsTitle}</h1>
        <div className="prose prose-invert max-w-none space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-zinc-900 mb-3">{section.title}</h2>
              {section.content.map((para, j) => (
                <p key={j} className="text-dark-300 text-sm leading-relaxed mb-3">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
