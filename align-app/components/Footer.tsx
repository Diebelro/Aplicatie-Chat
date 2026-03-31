"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AppCreditLine, DiebelAuthorLink } from "@/components/DiebelAuthorCredit";

export function Footer() {
  const { t } = useI18n();
  const termsLabel = t("legal.links.terms") as string;
  const privacyLabel = t("legal.links.privacy") as string;
  const cookiesLabel = t("legal.links.cookies") as string;

  return (
    <footer className="border-t border-dark-600 bg-dark-900/80 py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-dark-400">
          <Link href="/terms" className="hover:text-zinc-900 transition">
            {termsLabel}
          </Link>
          <Link href="/privacy" className="hover:text-zinc-900 transition">
            {privacyLabel}
          </Link>
          <Link href="/cookies" className="hover:text-zinc-900 transition">
            {cookiesLabel}
          </Link>
        </div>
        <LanguageSwitcher />
        <p className="text-dark-500 text-xs text-center">
          © {new Date().getFullYear()} <DiebelAuthorLink />. <AppCreditLine />
        </p>
      </div>
    </footer>
  );
}
