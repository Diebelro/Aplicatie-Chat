"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

/**
 * Linkuri către documentele legale publice — folosit în app autentificat și unde e util.
 */
export function LegalDocLinks({ className = "" }: { className?: string }) {
  const { tStr } = useI18n();

  return (
    <nav
      aria-label={tStr("appNav.legalNavAria")}
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] md:text-xs ${className}`}
    >
      <Link href="/terms" className="text-brand-400/90 hover:text-brand-300 hover:underline">
        {tStr("legal.links.terms")}
      </Link>
      <span className="text-dark-600 select-none" aria-hidden>
        ·
      </span>
      <Link href="/privacy" className="text-brand-400/90 hover:text-brand-300 hover:underline">
        {tStr("legal.links.privacy")}
      </Link>
      <span className="text-dark-600 select-none" aria-hidden>
        ·
      </span>
      <Link href="/cookies" className="text-brand-400/90 hover:text-brand-300 hover:underline">
        {tStr("legal.links.cookies")}
      </Link>
    </nav>
  );
}
