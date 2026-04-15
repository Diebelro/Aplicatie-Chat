"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationNeon } from "./DiebelCoupleIllustrations";

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

        <div
          className={`min-w-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 md:px-5 ${textAnimationClass}`}
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
