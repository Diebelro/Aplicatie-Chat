"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { getPrivacyContent } from "@/lib/i18n/legalContent";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Footer } from "@/components/Footer";

export default function PrivacyPage() {
  const { locale, t } = useI18n();
  const legal = t("legal") as { privacyTitle: string };
  const sections = getPrivacyContent(locale);

  return (
    <div className="min-h-screen flex flex-col bg-dark-900">
      <header className="border-b border-dark-600 sticky top-0 z-10 bg-dark-900 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-brand-400 hover:text-brand-300">
            Align
          </Link>
          <LanguageSwitcher openMenuBelow />
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <p className="text-dark-400 text-sm mb-4">
          {String(t("legal.relatedDocs"))}{" "}
          <Link href="/terms" className="text-brand-400 hover:underline">
            {String(t("legal.links.terms"))}
          </Link>
          {" · "}
          <Link href="/cookies" className="text-brand-400 hover:underline">
            {String(t("legal.links.cookies"))}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-zinc-100 mb-8">{legal.privacyTitle}</h1>
        <div className="prose prose-invert max-w-none space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-zinc-100 mb-3">{section.title}</h2>
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
