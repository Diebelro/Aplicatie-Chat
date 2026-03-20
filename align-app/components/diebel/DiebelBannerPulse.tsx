"use client";

import { useId } from "react";
import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationPulse } from "./DiebelCoupleIllustrations";

const PULSE_DOTS: { l: string; t: string; s: string; d: string }[] = [
  { l: "6%", t: "14%", s: "2px", d: "0s" },
  { l: "94%", t: "20%", s: "3px", d: "0.4s" },
  { l: "12%", t: "82%", s: "2px", d: "0.9s" },
  { l: "88%", t: "76%", s: "2px", d: "1.2s" },
  { l: "42%", t: "6%", s: "2px", d: "0.2s" },
  { l: "58%", t: "38%", s: "3px", d: "0.6s" },
];

/** Pulse Media — editorial luxury: catifea, aur, tipografie de revistă. */
export function DiebelBannerPulse({
  className = "",
  textAnimationClass = "",
  compact = false,
}: {
  className?: string;
  textAnimationClass?: string;
  compact?: boolean;
}) {
  const cornerId = useId().replace(/:/g, "");
  return (
    <div
      className={`relative isolate flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-xl border border-amber-200/15 shadow-[0_12px_48px_-10px_rgba(251,191,36,0.2),0_0_0_1px_rgba(255,255,255,0.06)_inset] sm:rounded-2xl ${className}`}
    >
      {/* Bază nocturnă */}
      <div className="absolute inset-0 bg-[#07030f]" />
      <div
        className="pointer-events-none absolute inset-0 motion-reduce:animate-none animate-diebelAurora opacity-90"
        style={{
          background:
            "linear-gradient(125deg, #1a0528 0%, #4c0d3d 25%, #5b1b4a 50%, #3d0f4a 75%, #1f0a2e 100%)",
          backgroundSize: "400% 400%",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/25 via-transparent to-violet-600/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-fuchsia-900/15" />

      {/* Linie aurie superioară */}
      <div
        className="pointer-events-none absolute left-[8%] right-[8%] top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent"
        aria-hidden
      />

      {/* Orbe cinematice */}
      <div
        className="pointer-events-none absolute -left-[25%] top-[-35%] h-[90%] w-[55%] rounded-full bg-gradient-to-br from-pink-500/45 to-fuchsia-600/25 blur-[64px] motion-reduce:animate-none animate-diebelOrb"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-[20%] bottom-[-30%] h-[80%] w-[50%] rounded-full bg-gradient-to-tl from-amber-400/20 to-rose-600/30 blur-[56px] motion-reduce:animate-none animate-diebelOrb"
        style={{ animationDelay: "2.8s" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[50%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-300/10 blur-[48px] motion-reduce:animate-none animate-diebelFlare"
        aria-hidden
      />

      {PULSE_DOTS.map((p, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full bg-amber-100 motion-reduce:opacity-50 animate-diebelTwinkle"
          style={{
            left: p.l,
            top: p.t,
            width: p.s,
            height: p.s,
            boxShadow: "0 0 10px rgba(253, 230, 138, 0.95), 0 0 20px rgba(251, 113, 133, 0.4)",
            animationDelay: p.d,
          }}
          aria-hidden
        />
      ))}

      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay motion-reduce:animate-none animate-diebelShimmer opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.04) 42%, rgba(255,250,235,0.18) 50%, rgba(255,255,255,0.06) 58%, transparent 100%)",
          backgroundSize: "240% 100%",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_45%,transparent_0%,rgba(7,3,15,0.75)_100%)]"
        aria-hidden
      />
      {/* Corner frame */}
      <svg
        className="pointer-events-none absolute right-2 top-2 h-12 w-12 opacity-[0.15] sm:right-4 sm:top-3 sm:h-16 sm:w-16"
        viewBox="0 0 64 64"
        aria-hidden
      >
        <path d="M64 0v20M64 0H44" fill="none" stroke={`url(#pulseCorner-${cornerId})`} strokeWidth="1" />
        <defs>
          <linearGradient id={`pulseCorner-${cornerId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 flex h-full min-h-0 w-full items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-5 sm:py-3 md:gap-6 md:px-7">
        <DiebelHeartLogo
          variant={compact ? "standard" : "hero"}
          tone="rose"
          className="shrink-0 drop-shadow-[0_0_24px_rgba(244,114,182,0.35)]"
        />

        <div
          className={`min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-2 shadow-inner shadow-black/20 backdrop-blur-md sm:rounded-2xl sm:px-4 sm:py-3 md:px-5 ${textAnimationClass}`}
        >
          <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-amber-200/85 sm:text-[10px]">
            Pulse Media
          </p>
          <h2 className="mt-1 bg-gradient-to-r from-white via-rose-100 to-amber-100 bg-clip-text font-bold tracking-tight text-transparent text-base sm:text-lg md:text-xl">
            DIEBEL
          </h2>
          <p className="mt-1 font-serif text-[11px] leading-relaxed text-white/95 sm:text-xs md:text-sm [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
            Două inimi. O singură vibrație.
          </p>
          <p className="mt-0.5 font-serif text-[11px] leading-relaxed text-white/88 sm:text-xs md:text-sm [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]">
            Mesaje nelimitate. Conexiuni reale.
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-pink-200/95 sm:text-[11px] md:text-xs">
            Intră în ritmul iubirii.
          </p>
        </div>

        <CoupleIllustrationPulse
          className={compact ? "!max-h-[150px] !min-w-[80px] sm:!min-w-[100px]" : "opacity-95"}
        />
      </div>
    </div>
  );
}
