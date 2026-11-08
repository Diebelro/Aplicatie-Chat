"use client";

import Link from "next/link";
import { DiebelWordmark } from "@/components/DiebelWordmark";
import { useI18n } from "@/lib/i18n/context";

const CONTACT = "contact@diebel.ro";

/** Conținutul paginii Child Safety — 100% din i18n (pages.childSafety), urmează limba UI. */
export function ChildSafetyContent() {
  const { tStr, translations } = useI18n();
  type Section = { title: string; body: string; contact?: boolean };
  const childSafety = (translations?.pages as Record<string, unknown> | undefined)?.childSafety as { sections?: Section[] } | undefined;
  const sections: Section[] = Array.isArray(childSafety?.sections) ? childSafety.sections : [];
  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-zinc-900">
      <header className="border-b border-dark-600 sticky top-0 z-10 bg-dark-900 pt-[var(--safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" aria-label="Diebel">
            <DiebelWordmark variant="header" withMark />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">{tStr("pages.childSafety.pageTitle")}</h1>
        <p className="text-dark-200 text-sm">{tStr("pages.childSafety.lastUpdated")}</p>

        {Array.isArray(sections) &&
          sections.map((s, i) => (
            <section key={i} className="space-y-3">
              <h2 className="text-lg font-semibold">
                {i + 1}. {s.title}
              </h2>
              <p className="text-dark-200 leading-relaxed">
                {s.body}
                {s.contact ? (
                  <>
                    {" "}
                    <a href={`mailto:${CONTACT}`} className="text-brand-600 underline">
                      {CONTACT}
                    </a>
                  </>
                ) : null}
              </p>
            </section>
          ))}
      </main>
    </div>
  );
}
