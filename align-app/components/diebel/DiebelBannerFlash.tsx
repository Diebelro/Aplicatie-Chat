"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationFlash } from "./DiebelCoupleIllustrations";

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

        <div
          className={`min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 md:px-5 ${textAnimationClass}`}
        >
          <p className="text-[10px] font-semibold leading-snug text-zinc-200 sm:text-xs md:text-sm">
            Cea mai simplă aplicație de chat
          </p>
          <h2 className="mt-0.5 font-bold tracking-tight text-white text-base sm:text-lg md:text-xl">
            DIEBEL
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-100 sm:text-xs md:text-sm">
            Mesaje rapide. Conexiuni reale.
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300 sm:text-xs md:text-sm">
            Două inimi. O singură vibrație.
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-zinc-300 sm:text-[11px] md:text-xs">
            Intră acum — chat rapid, fără bătăi de cap.
          </p>
        </div>

        <CoupleIllustrationFlash
          className={compact ? "!max-h-[150px] !min-w-[80px] opacity-80 sm:!min-w-[100px]" : "max-w-[40%] opacity-80"}
        />
      </div>
    </div>
  );
}
