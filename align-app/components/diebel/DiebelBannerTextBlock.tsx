"use client";

import { useI18n } from "@/lib/i18n/context";

/**
 * Text comun pentru toate slide-urile carousel DIEBEL — sursă i18n (urmează limba UI).
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
    <div className={`${box} ${textAnimationClass} ${contentClassName}`.trim()}>
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
      <p className="mt-1.5 text-[10px] font-medium text-zinc-300 sm:text-[11px] md:text-xs">
        {tStr("diebelPromo.cta")}
      </p>
    </div>
  );
}
