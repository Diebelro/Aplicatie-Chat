"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

/** Banner discret când lipsește țara — nu blochează chatul. */
export function CountryRequiredBanner() {
  const { tStr } = useI18n();
  return (
    <div className="mx-auto w-full max-w-5xl px-3 pt-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
        <MapPin className="w-4 h-4 shrink-0 text-amber-600" aria-hidden />
        <p className="flex-1 min-w-0 leading-snug">{tStr("pages.profile.countryGateBanner")}</p>
        <Link
          href="/app/profile?needCountry=1"
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 touch-manipulation"
        >
          {tStr("pages.profile.countryGateCta")}
        </Link>
      </div>
    </div>
  );
}
