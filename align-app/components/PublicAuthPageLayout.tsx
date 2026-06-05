"use client";

import Link from "next/link";
import { DiebelCopyrightStrip } from "@/components/DiebelAuthorCredit";

type PublicAuthPageLayoutProps = {
  backHref?: string;
  backLabel: string;
  children: React.ReactNode;
  /** Copyright fix jos, în afara zonei de scroll — nu se suprapune cu formularul. */
  showCopyright?: boolean;
};

/**
 * Shell pentru login / signup: safe-area sus (semnal, baterie), scroll central, credit Diebel jos.
 */
export function PublicAuthPageLayout({
  backHref = "/",
  backLabel,
  children,
  showCopyright = true,
}: PublicAuthPageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-dark-900 safe-area-x">
      <div className="shrink-0 px-4 safe-area-inset-top pt-3">
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-400 hover:text-brand-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-0.5 -ml-0.5"
        >
          {backLabel}
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4">
        {children}
      </div>

      {showCopyright ? (
        <footer className="shrink-0 border-t border-dark-600/40 bg-dark-900/95 px-4 py-3 safe-area-inset-bottom">
          <DiebelCopyrightStrip className="opacity-80" />
        </footer>
      ) : null}
    </div>
  );
}
