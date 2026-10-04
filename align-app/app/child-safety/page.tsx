import React from "react";
import Link from "next/link";
import { DiebelWordmark } from "@/components/DiebelWordmark";

export const metadata = {
  title: "Child Safety Standards – Diebel Chat",
  description: "Diebel Chat child safety and CSAE prevention standards.",
};

export default function ChildSafetyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <header className="border-b border-dark-600 sticky top-0 z-10 bg-dark-900 pt-[var(--safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" aria-label="Diebel">
            <DiebelWordmark variant="header" withMark />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Child Safety Standards</h1>
        <p className="text-dark-200 text-sm">Last updated: June 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Age Restriction</h2>
          <p className="text-dark-200 leading-relaxed">
            Diebel Chat is strictly intended for users aged 18 and older. All
            users are required to confirm they are at least 18 years old during
            registration. Accounts found to belong to minors are immediately
            suspended and deleted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            2. Zero Tolerance for CSAE
          </h2>
          <p className="text-dark-200 leading-relaxed">
            Diebel Chat has a strict zero-tolerance policy toward child sexual
            abuse and exploitation (CSAE). Any content, behavior, or account
            that involves the sexual exploitation or abuse of minors is
            immediately removed and reported to the relevant national
            authorities, including through the National Center for Missing &amp;
            Exploited Children (NCMEC) CyberTipline where applicable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Reporting Mechanisms</h2>
          <p className="text-dark-200 leading-relaxed">
            Users can report any suspected child safety concern directly within
            the app using the in-app report feature available on every user
            profile and message. Reports are reviewed promptly by our team.
            Users can also contact us directly at{" "}
            <a
              href="mailto:contact@diebel.ro"
              className="text-brand-400 underline"
            >
              contact@diebel.ro
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. User Blocking</h2>
          <p className="text-dark-200 leading-relaxed">
            Any user can block another user at any time. Blocked users cannot
            send messages, view profiles, or initiate calls with the user who
            blocked them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Legal Compliance</h2>
          <p className="text-dark-200 leading-relaxed">
            Diebel Chat complies with all applicable child safety laws and
            regulations. We cooperate fully with law enforcement agencies and
            report confirmed cases of child sexual abuse material (CSAM) to the
            appropriate regional and national authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Contact</h2>
          <p className="text-dark-200 leading-relaxed">
            For child safety concerns or CSAM reports, contact our designated
            safety officer at:{" "}
            <a
              href="mailto:contact@diebel.ro"
              className="text-brand-400 underline"
            >
              contact@diebel.ro
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t border-dark-600 py-4 text-center text-dark-400 text-xs">
        © {new Date().getFullYear()} Diebel Chat ·{" "}
        <Link href="/privacy" className="hover:text-white transition-colors">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="hover:text-white transition-colors">
          Terms
        </Link>
      </footer>
    </div>
  );
}
