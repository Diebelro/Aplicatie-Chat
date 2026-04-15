"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { getTermsContent } from "@/lib/i18n/legalContent";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Footer } from "@/components/Footer";
import { DiebelWordmark } from "@/components/DiebelWordmark";

export default function TermsPage() {
  const { locale, t } = useI18n();
  const legal = t("legal") as { termsTitle: string };
  const sections = getTermsContent(locale);

  return (
    <div className="min-h-screen flex flex-col bg-dark-900">
      <header className="border-b border-dark-600 sticky top-0 bg-dark-900/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center min-h-[44px] min-w-[44px] -ml-1 pl-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900"
            aria-label="Diebel"
          >
            <DiebelWordmark variant="header" />
          </Link>
          <LanguageSwitcher openMenuBelow />
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <p className="ui-subtitle text-sm mb-4">
          {String(t("legal.relatedDocs"))}{" "}
          <Link href="/privacy" className="text-brand-700 font-medium hover:text-brand-600 hover:underline">
            {String(t("legal.links.privacy"))}
          </Link>
          {" · "}
          <Link href="/cookies" className="text-brand-700 font-medium hover:text-brand-600 hover:underline">
            {String(t("legal.links.cookies"))}
          </Link>
        </p>
        <h1 className="ui-page-title text-2xl mb-8">{legal.termsTitle}</h1>
        <div className="max-w-none space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="ui-page-title text-lg mb-3">{section.title}</h2>
              {section.content.map((para, j) => (
                <p key={j} className="ui-subtitle text-sm leading-relaxed mb-3">
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
