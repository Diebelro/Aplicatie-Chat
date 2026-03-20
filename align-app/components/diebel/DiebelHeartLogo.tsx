"use client";

import { useId } from "react";

const MINI_D =
  "M6 10.2l-.65-.6C2.6 7.2 1 5.8 1 4.1 1 2.7 2.2 1.5 3.8 1.5c.8 0 1.55.35 2 .9.45-.55 1.2-.9 2-.9 1.6 0 2.8 1.2 2.8 2.8 0 1.7-1.6 3.1-4.35 5.5L6 10.2z";

const LAYOUT: { x: number; y: number; r: number; s: number }[] = [
  { x: 60, y: 34, r: -5, s: 0.95 },
  { x: 46, y: 38, r: -18, s: 0.74 },
  { x: 74, y: 38, r: 18, s: 0.74 },
  { x: 40, y: 48, r: -26, s: 0.66 },
  { x: 80, y: 48, r: 26, s: 0.66 },
  { x: 52, y: 44, r: -4, s: 0.6 },
  { x: 68, y: 44, r: 4, s: 0.6 },
  { x: 60, y: 50, r: 0, s: 0.82 },
  { x: 48, y: 56, r: -12, s: 0.62 },
  { x: 72, y: 56, r: 12, s: 0.62 },
  { x: 42, y: 64, r: -20, s: 0.56 },
  { x: 78, y: 64, r: 20, s: 0.56 },
  { x: 54, y: 62, r: -2, s: 0.64 },
  { x: 66, y: 62, r: 2, s: 0.64 },
  { x: 60, y: 70, r: 0, s: 0.72 },
  { x: 50, y: 76, r: -10, s: 0.54 },
  { x: 70, y: 76, r: 10, s: 0.54 },
  { x: 60, y: 84, r: 0, s: 0.5 },
  { x: 36, y: 52, r: -34, s: 0.52 },
  { x: 84, y: 52, r: 34, s: 0.52 },
  { x: 44, y: 40, r: -22, s: 0.56 },
  { x: 76, y: 40, r: 22, s: 0.56 },
  { x: 60, y: 58, r: 0, s: 0.44 },
  { x: 58, y: 66, r: -6, s: 0.48 },
  { x: 62, y: 66, r: 6, s: 0.48 },
];

export type DiebelHeartLogoVariant = "hero" | "standard" | "compact";

/** Accente de culoare sincronizate cu fiecare banner. */
export type DiebelHeartTone = "brand" | "rose" | "ember" | "spectral";

const TONE_STOPS: Record<
  DiebelHeartTone,
  { a: string; b: string; c: string; glowA: string; glowB: string }
> = {
  brand: { a: "#FF2D55", b: "#FF4081", c: "#FF6A00", glowA: "rgba(255,45,85,0.75)", glowB: "rgba(255,106,0,0.45)" },
  rose: { a: "#fb7185", b: "#e879f9", c: "#c084fc", glowA: "rgba(251,113,133,0.8)", glowB: "rgba(192,132,252,0.5)" },
  ember: { a: "#ff1744", b: "#ff6b35", c: "#ffb020", glowA: "rgba(255,107,53,0.85)", glowB: "rgba(255,176,32,0.45)" },
  spectral: { a: "#22d3ee", b: "#e879f9", c: "#a855f7", glowA: "rgba(34,211,238,0.65)", glowB: "rgba(232,121,249,0.55)" },
};

const SIZE_MAP: Record<DiebelHeartLogoVariant, string> = {
  hero: "h-[4.25rem] w-[4.25rem] sm:h-[5.25rem] sm:w-[5.25rem] md:h-[5.75rem] md:w-[5.75rem]",
  standard: "h-14 w-14 sm:h-16 sm:w-16",
  compact: "h-11 w-11 sm:h-12 sm:w-12",
};

type DiebelHeartLogoProps = {
  className?: string;
  variant?: DiebelHeartLogoVariant;
  /** Paletă sincronizată cu bannerul (default: brand). */
  tone?: DiebelHeartTone;
  sizeClass?: string;
  svgPrefix?: string;
};

export function DiebelHeartLogo({
  className = "",
  variant = "standard",
  tone = "brand",
  sizeClass,
  svgPrefix,
}: DiebelHeartLogoProps) {
  const rid = useId().replace(/:/g, "");
  const prefix = svgPrefix ?? `dh-${rid}`;
  const box = sizeClass ?? SIZE_MAP[variant];
  const isHero = variant === "hero";
  const t = TONE_STOPS[tone];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${box} ${className} ${isHero ? "motion-reduce:animate-none animate-diebelFloat" : ""}`}
    >
      {/* Glow în straturi */}
      <div
        className="pointer-events-none absolute inset-[-45%] rounded-[38%] opacity-50 blur-2xl motion-reduce:opacity-35 motion-reduce:blur-xl"
        style={{
          background: `linear-gradient(135deg, ${t.a}, ${t.b}, ${t.c})`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[-25%] rounded-[36%] opacity-30 blur-xl motion-reduce:opacity-20"
        style={{ backgroundColor: t.a }}
        aria-hidden
      />
      {isHero && (
        <div
          className="pointer-events-none absolute inset-[-60%] rounded-full bg-gradient-to-t from-white/10 to-transparent opacity-30 blur-3xl animate-diebelOrb motion-reduce:animate-none"
          aria-hidden
        />
      )}
      <svg
        viewBox="0 0 120 120"
        className="relative z-[1] h-full w-full animate-pulseLogo motion-reduce:animate-none"
        style={{
          filter: `drop-shadow(0 0 12px ${t.glowA}) drop-shadow(0 0 28px ${t.glowB}) drop-shadow(0 2px 4px rgba(0,0,0,0.35))`,
        }}
        role="img"
        aria-label="DIEBEL"
      >
        <defs>
          <linearGradient id={`${prefix}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.a} />
            <stop offset="40%" stopColor={t.b} />
            <stop offset="100%" stopColor={t.c} />
          </linearGradient>
          <filter id={`${prefix}-soft`} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g fill={`url(#${prefix}-grad)`} filter={`url(#${prefix}-soft)`}>
          {LAYOUT.map((p, i) => (
            <path
              key={i}
              d={MINI_D}
              transform={`translate(${p.x - 6}, ${p.y - 8}) rotate(${p.r}) scale(${p.s})`}
              opacity={0.92 + (i % 4) * 0.015}
            />
          ))}
        </g>
        <path
          d="M60 100c-22-12-34-25-34-40 0-11 8-18 18-18 5 0 10 2 14 6 4-4 9-6 14-6 10 0 18 7 18 18 0 15-12 28-34 40z"
          fill="none"
          stroke={`url(#${prefix}-grad)`}
          strokeWidth={1.4}
          opacity={0.5}
        />
      </svg>
    </div>
  );
}
