"use client";

import Link from "next/link";
import { CommunityGuidelinesBody } from "@/components/legal/CommunityGuidelinesBody";
import { useI18n } from "@/lib/i18n/context";

export default function AppCommunityRulesPage() {
  const { tStr } = useI18n();
  return (
    <div className="max-w-xl mx-auto space-y-6 pb-8 px-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/app/settings/account" className="text-dark-400 hover:text-zinc-900 transition text-sm shrink-0">
          {tStr("pages.feedback.backToAccount")}
        </Link>
        <h1 className="app-pro-page-title">{tStr("pages.communityGuidelines.pageTitle")}</h1>
      </div>
      <CommunityGuidelinesBody showPlayNote={false} />
    </div>
  );
}
