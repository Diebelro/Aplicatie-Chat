"use client";

import { DiebelHeartLogo } from "./DiebelHeartLogo";
import { CoupleIllustrationNeon } from "./DiebelCoupleIllustrations";

const NEON_DOTS: { l: string; t: string; c: string; d: string }[] = [
  { l: "10%", t: "20%", c: "#22d3ee", d: "0s" },
  { l: "90%", t: "24%", c: "#e879f9", d: "0.3s" },
  { l: "20%", t: "70%", c: "#a855f7", d: "0.65s" },
  { l: "78%", t: "66%", c: "#22d3ee", d: "1s" },
  { l: "50%", t: "10%", c: "#f0abfc", d: "0.45s" },
];

/** NextWave — holo-night: grilă perspectivă, cromatic subtil, neon couture. */
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
      className={`relative isolate flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-xl border border-cyan-400/20 shadow-[0_12px_56px_-6px_rgba(168,85,247,0.45),0_0_0_1px_rgba(34,211,238,0.12),inset_0_0_60px_rgba(139,92,246,0.08)] sm:rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-[#050214]" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#2e1065] to-[#4a044e]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-transparent to-fuchsia-500/25" />
      <div className="absolute inset-0 bg-gradient-to-b from-violet-900/30 via-transparent to-black/75" />

      {/* Grilă perspectivă */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] origin-bottom motion-reduce:opacity-[0.04] animate-diebelGridPulse"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,121,249,0.12) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          transform: "perspective(200px) rotateX(58deg) scale(1.15)",
          maskImage: "linear-gradient(to top, black 0%, transparent 85%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute left-[10%] top-[-25%] h-[70%] w-[44%] rounded-full bg-fuchsia-500/30 blur-[56px] motion-reduce:animate-none animate-diebelOrb"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[0%] bottom-[-30%] h-[68%] w-[52%] rounded-full bg-cyan-400/20 blur-[52px] motion-reduce:animate-none animate-diebelOrb"
        style={{ animationDelay: "2.6s" }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] motion-reduce:opacity-8 motion-reduce:animate-none animate-sweep"
        style={{
          background: "linear-gradient(100deg, transparent 38%, rgba(255,255,255,0.25) 50%, transparent 62%)",
          maskImage: "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        }}
        aria-hidden
      />

      {NEON_DOTS.map((p, i) => (
        <div
          key={i}
          className="pointer-events-none absolute h-1 w-1 rounded-full motion-reduce:opacity-50 animate-diebelTwinkle"
          style={{
            left: p.l,
            top: p.t,
            backgroundColor: p.c,
            boxShadow: `0 0 10px ${p.c}, 0 0 22px ${p.c}`,
            animationDelay: p.d,
          }}
          aria-hidden
        />
      ))}

      <div
        className="pointer-events-none absolute inset-0 mix-blend-plus-lighter motion-reduce:animate-none animate-diebelShimmer opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(100deg, transparent 0%, rgba(34,211,238,0.12) 44%, rgba(232,121,249,0.35) 50%, rgba(168,85,247,0.15) 56%, transparent 100%)",
          backgroundSize: "280% 100%",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,transparent_0%,rgba(5,2,20,0.82)_100%)]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 w-full items-center gap-2 px-2.5 py-2 sm:gap-4 sm:px-5 sm:py-3 md:gap-6 md:px-7">
        <DiebelHeartLogo
          variant={compact ? "standard" : "hero"}
          tone="spectral"
          className="shrink-0 drop-shadow-[0_0_26px_rgba(34,211,238,0.35)]"
        />

        <div
          className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border border-cyan-400/20 bg-violet-950/40 px-2.5 py-2 shadow-inner shadow-cyan-500/10 backdrop-blur-md sm:rounded-2xl sm:px-4 sm:py-3 md:px-5 ${textAnimationClass}`}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-cyan-200/85 sm:text-[10px]">
            NextWave Digital
          </p>
          {/* Titlu cromatic dublu */}
          <div className="relative mt-0.5">
            <h2
              className="pointer-events-none absolute left-[2px] top-[2px] font-black tracking-tight text-base text-fuchsia-500/35 blur-[0.5px] sm:text-lg md:text-xl"
              aria-hidden
            >
              DIEBEL
            </h2>
            <h2 className="relative bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-violet-200 bg-clip-text font-black tracking-tight text-transparent text-base sm:text-lg md:text-xl [filter:drop-shadow(0_0_20px_rgba(232,121,249,0.45))]">
              DIEBEL
            </h2>
          </div>
          <p className="mt-1 text-[11px] font-extrabold leading-snug text-white sm:text-xs md:text-sm [text-shadow:0_0_18px_rgba(0,0,0,0.6)]">
            Zero reguli. Zero complicații.
          </p>
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-white/92 sm:text-xs md:text-sm [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
            Mesaje rapide. Conexiuni adevărate.
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-100 sm:text-xs md:text-sm [text-shadow:0_0_16px_rgba(34,211,238,0.45)]">
            <span className="inline-block h-1.5 w-1.5 animate-diebelFlash rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
            Hai direct la treabă.
          </p>
        </div>

        <CoupleIllustrationNeon
          className={compact ? "!max-h-[150px] !min-w-[80px] sm:!min-w-[100px]" : "opacity-[0.97]"}
        />
      </div>
    </div>
  );
}
