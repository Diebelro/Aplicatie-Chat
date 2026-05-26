"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

/** Conținut reguli comunitate — folosit pe /community-rules și în app settings. */
export function CommunityGuidelinesBody({ showPlayNote = true }: { showPlayNote?: boolean }) {
  const { tStr, tArray } = useI18n();
  const rules = tArray("pages.communityGuidelines.rules");

  return (
    <div className="space-y-5 text-dark-300 text-sm leading-relaxed max-w-prose">
      <p className="text-zinc-100 font-medium">{tStr("pages.communityGuidelines.intro")}</p>
      <p>{tStr("pages.communityGuidelines.forbiddenLead")}</p>
      <ul className="list-disc pl-5 space-y-2 marker:text-brand-500">
        {rules.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="text-dark-400 text-xs">{tStr("pages.communityGuidelines.footer")}</p>
      {showPlayNote && (
        <div className="rounded-xl border border-dark-600 bg-dark-800/50 p-4 text-xs text-dark-400">
          <p className="font-medium text-dark-300 mb-1">{tStr("pages.communityGuidelines.playStoreNoteTitle")}</p>
          <p>{tStr("pages.communityGuidelines.playStoreNoteBody")}</p>
        </div>
      )}
      <p className="text-xs">
        <Link href="/terms" className="text-brand-400 hover:underline">
          {tStr("legal.links.terms")}
        </Link>
        {" · "}
        <Link href="/privacy" className="text-brand-400 hover:underline">
          {tStr("legal.links.privacy")}
        </Link>
      </p>
    </div>
  );
}
