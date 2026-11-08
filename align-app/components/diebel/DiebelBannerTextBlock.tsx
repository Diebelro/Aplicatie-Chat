"use client";

import { useI18n } from "@/lib/i18n/context";
import { openDiebelExternal } from "@/lib/diebelExternalLink";

const ADS_BOOST = "https://ads.diebel.ro/campanie/nou";

/**
 * Text comun pentru toate slide-urile carousel DIEBEL — sursă i18n (urmează limba UI).
 * CTA deschide Diebel Ads (Boost), nu e text mort.
 */
export function DiebelBannerTextBlock({
  textAnimationClass,
  contentClassName = "",
}: {
  textAnimationClass: string;
  /** Ex.: overflow-hidden pe varianta „next wave”. */
  contentClassName?: string;
}) {
  const { tStr } = useI18n();
  const box =
    "min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 md:px-5";

  return (
    <a
      href={ADS_BOOST}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openDiebelExternal(ADS_BOOST);
      }}
      className={`${box} ${textAnimationClass} ${contentClassName} block cursor-pointer no-underline`.trim()}
    >
      <p className="text-[10px] font-semibold leading-snug text-zinc-200 sm:text-xs md:text-sm">
        {tStr("diebelPromo.tagline")}
      </p>
      <h2 className="mt-0.5 font-bold tracking-tight text-white text-base sm:text-lg md:text-xl">
        {tStr("diebelPromo.title")}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-100 sm:text-xs md:text-sm">
        {tStr("diebelPromo.subtitle")}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300 sm:text-xs md:text-sm">
        {tStr("diebelPromo.emotional")}
      </p>
      <span className="mt-2 inline-flex rounded-full bg-amber-200 px-3 py-1 text-[11px] font-semibold text-zinc-900 sm:text-xs">
        {tStr("diebelPromo.boostCta")}
      </span>
    </a>
  );
}
