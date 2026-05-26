"use client";

import Link from "next/link";
import { CommunityGuidelinesBody } from "@/components/legal/CommunityGuidelinesBody";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function CommunityRulesPublicPage() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-dvh bg-dark-900 text-zinc-100 px-4 py-10 pb-16">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-brand-400 text-sm font-medium hover:underline">
          ← {tStr("pages.communityGuidelines.backHome")}
        </Link>
        <h1 className="text-2xl font-bold mt-6 tracking-tight">{tStr("pages.communityGuidelines.pageTitle")}</h1>
        <div className="mt-8">
          <CommunityGuidelinesBody showPlayNote />
        </div>
        <div className="mt-10 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
