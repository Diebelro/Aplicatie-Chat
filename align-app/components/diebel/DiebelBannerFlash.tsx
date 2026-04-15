"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationFlash } from "./DiebelCoupleIllustrations";
import { DiebelBannerTextBlock } from "./DiebelBannerTextBlock";

/** Hero DIEBEL — variantă discretă, fără linii animate și fără glow pe text. */
export function DiebelBannerFlash({
  className = "",
  textAnimationClass = "",
  compact = false,
}: {
  className?: string;
  textAnimationClass?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative isolate flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0308] shadow-md shadow-black/40 sm:rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-rose-950/55 via-[#1f080c] to-zinc-950" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tl from-orange-900/15 via-transparent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-1/4 h-1/2 w-2/5 rounded-full bg-orange-600/10 blur-[48px]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 w-full items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-5 sm:py-3 md:gap-6 md:px-7">
        <DiebelHeartLogo
          variant={compact ? "standard" : "hero"}
          tone="ember"
          className="shrink-0 opacity-90"
        />

        <DiebelBannerTextBlock textAnimationClass={textAnimationClass} />

        <CoupleIllustrationFlash
          className={compact ? "!max-h-[150px] !min-w-[80px] opacity-80 sm:!min-w-[100px]" : "max-w-[40%] opacity-80"}
        />
      </div>
    </div>
  );
}
