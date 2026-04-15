"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationPulse } from "./DiebelCoupleIllustrations";
import { DiebelBannerTextBlock } from "./DiebelBannerTextBlock";

/** Hero DIEBEL — variantă discretă, fără particule/orb-uri animate. */
export function DiebelBannerPulse({
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
      className={`relative isolate flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-[#07030f] shadow-md shadow-black/40 sm:rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-rose-950/50 via-[#1a0a18] to-violet-950/40" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-fuchsia-950/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-1/4 top-0 h-[65%] w-1/2 rounded-full bg-rose-600/10 blur-[56px]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 w-full items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-5 sm:py-3 md:gap-6 md:px-7">
        <DiebelHeartLogo
          variant={compact ? "standard" : "hero"}
          tone="rose"
          className="shrink-0 opacity-90"
        />

        <DiebelBannerTextBlock textAnimationClass={textAnimationClass} />

        <CoupleIllustrationPulse
          className={compact ? "!max-h-[150px] !min-w-[80px] opacity-80 sm:!min-w-[100px]" : "max-w-[40%] opacity-80"}
        />
      </div>
    </div>
  );
}
