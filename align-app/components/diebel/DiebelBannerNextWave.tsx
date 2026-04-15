"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationNeon } from "./DiebelCoupleIllustrations";
import { DiebelBannerTextBlock } from "./DiebelBannerTextBlock";

/** Hero DIEBEL — variantă discretă: fundal calm, text lizibil, fără neon/pulse agresive. */
export function DiebelBannerNextWave({
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
      className={`relative isolate flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0a12] shadow-md shadow-black/40 sm:rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/90 via-[#12101c] to-zinc-950" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-violet-900/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-0 h-[70%] w-[55%] rounded-full bg-violet-600/10 blur-[64px] motion-reduce:opacity-50"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 w-full items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-5 sm:py-3 md:gap-6 md:px-7">
        <DiebelHeartLogo
          variant={compact ? "standard" : "hero"}
          tone="spectral"
          className="shrink-0 opacity-90"
        />

        <DiebelBannerTextBlock textAnimationClass={textAnimationClass} contentClassName="overflow-hidden" />

        <CoupleIllustrationNeon
          className={
            compact
              ? "!max-h-[150px] !min-w-[80px] opacity-[0.72] sm:!min-w-[100px]"
              : "max-w-[40%] opacity-[0.72]"
          }
        />
      </div>
    </div>
  );
}
