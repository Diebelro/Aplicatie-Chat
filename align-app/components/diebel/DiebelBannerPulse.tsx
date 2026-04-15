"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationPulse } from "./DiebelCoupleIllustrations";

/** Pulse Media — variantă discretă, fără particule/orb-uri animate. */
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

        <div
          className={`min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 md:px-5 ${textAnimationClass}`}
        >
          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px]">
            Pulse Media
          </p>
          <h2 className="mt-0.5 font-bold tracking-tight text-white text-base sm:text-lg md:text-xl">
            DIEBEL
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-100 sm:text-xs md:text-sm">
            Două inimi. O singură vibrație.
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-300 sm:text-xs md:text-sm">
            Mesaje nelimitate. Conexiuni reale.
          </p>
          <p className="mt-1.5 text-[10px] font-medium text-zinc-400 sm:text-[11px] md:text-xs">
            Intră în ritmul iubirii.
          </p>
        </div>

        <CoupleIllustrationPulse
          className={compact ? "!max-h-[150px] !min-w-[80px] opacity-80 sm:!min-w-[100px]" : "max-w-[40%] opacity-80"}
        />
      </div>
    </div>
  );
}
