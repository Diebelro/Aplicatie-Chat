"use client";

import { useId } from "react";
import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationFlash } from "./DiebelCoupleIllustrations";

const FLASH_DOTS: { l: string; t: string; d: string }[] = [
  { l: "8%", t: "22%", d: "0s" },
  { l: "90%", t: "18%", d: "0.35s" },
  { l: "18%", t: "72%", d: "0.7s" },
  { l: "82%", t: "68%", d: "1s" },
  { l: "48%", t: "12%", d: "0.15s" },
];

/** FlashVision — energie editorială, contrast tipografic, „cover” de campanie. */
export function DiebelBannerFlash({
  className = "",
  textAnimationClass = "",
  compact = false,
}: {
  className?: string;
  textAnimationClass?: string;
  compact?: boolean;
}) {
  const streakId = useId().replace(/:/g, "");
  return (
    <div
      className={`relative isolate flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-xl border border-orange-400/25 shadow-[0_14px_50px_-8px_rgba(255,80,40,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-[#0a0308]" />
      <div className="absolute inset-0 bg-gradient-to-br from-rose-950 via-[#4a0618] to-[#1a0508]" />
      <div className="absolute inset-0 bg-gradient-to-bl from-orange-500/35 via-transparent to-red-600/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-red-950/20 to-orange-400/10" />

      {/* Panou diagonal luminos */}
      <div
        className="pointer-events-none absolute -right-[20%] top-0 h-[140%] w-[55%] skew-x-[-12deg] bg-gradient-to-b from-white/12 via-orange-400/15 to-transparent opacity-60"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] motion-reduce:opacity-8 motion-reduce:animate-none animate-moveDiag"
        style={{
          background:
            "repeating-linear-gradient(135deg, transparent 0, transparent 14px, rgba(255,255,255,0.06) 14px, rgba(255,255,255,0.06) 15px)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute -right-[8%] top-[-25%] h-[75%] w-[48%] rounded-full bg-gradient-to-br from-orange-400/50 to-red-500/30 blur-[56px] motion-reduce:animate-none animate-diebelOrb"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-[10%] bottom-[-20%] h-[65%] w-[42%] rounded-full bg-rose-600/35 blur-[48px] motion-reduce:animate-none animate-diebelOrb"
        style={{ animationDelay: "3.2s" }}
        aria-hidden
      />

      {FLASH_DOTS.map((p, i) => (
        <div
          key={i}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-amber-50 motion-reduce:opacity-60 animate-diebelTwinkle"
          style={{
            left: p.l,
            top: p.t,
            boxShadow: "0 0 12px rgba(255, 200, 120, 1), 0 0 22px rgba(255, 90, 60, 0.5)",
            animationDelay: p.d,
          }}
          aria-hidden
        />
      ))}

      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen motion-reduce:animate-none animate-diebelShimmer opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(118deg, transparent 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.08) 60%, transparent 100%)",
          backgroundSize: "260% 100%",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_25%,rgba(255,255,255,0.14)_0%,transparent_50%)] motion-reduce:animate-none animate-diebelFlare"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_100%,transparent_0%,rgba(10,3,8,0.7)_100%)]"
        aria-hidden
      />

      {/* SVG streaks */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.2] motion-reduce:opacity-10"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={`flashStreak-${streakId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffb86b" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="35" x2="100" y2="20" stroke={`url(#flashStreak-${streakId})`} strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="55" x2="100" y2="48" stroke={`url(#flashStreak-${streakId})`} strokeWidth="0.25" opacity="0.6" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="relative z-10 flex h-full min-h-0 w-full items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-5 sm:py-3 md:gap-6 md:px-7">
        <DiebelHeartLogo
          variant={compact ? "standard" : "hero"}
          tone="ember"
          className="shrink-0 drop-shadow-[0_0_28px_rgba(255,107,53,0.45)]"
        />

        <div
          className={`min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 shadow-lg shadow-orange-950/40 backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3 md:px-5 ${textAnimationClass}`}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-orange-200/90 sm:text-[10px]">
            FlashVision
          </p>
          <h2 className="mt-0.5 font-black italic tracking-tighter text-white text-base sm:text-lg md:text-xl [text-shadow:0_0_40px_rgba(255,100,50,0.35),0_2px_0_rgba(0,0,0,0.5)]">
            DIEBEL
          </h2>
          <p className="mt-1 text-[11px] font-bold leading-snug text-white sm:text-xs md:text-sm [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
            Atracție{" "}
            <span className="relative inline-block text-[#ffc078] drop-shadow-[0_0_14px_rgba(255,192,120,0.85)]">
              instant
            </span>
            . Energie reală.
          </p>
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-white/95 sm:text-xs md:text-sm [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
            Scrie direct. Trăiește{" "}
            <span className="text-[#ffb088] drop-shadow-[0_0_12px_rgba(255,176,136,0.7)]">intens</span>.
          </p>
          <p className="mt-1 border-l-2 border-orange-400/70 pl-2 text-[10px] font-bold uppercase tracking-wide text-white/95 sm:text-[11px]">
            Nu aștepta. Acționează.
          </p>
        </div>

        <CoupleIllustrationFlash
          className={compact ? "!max-h-[150px] !min-w-[80px] sm:!min-w-[100px]" : "opacity-[0.98]"}
        />
      </div>
    </div>
  );
}
