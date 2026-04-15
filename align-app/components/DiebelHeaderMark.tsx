"use client";

import { useId } from "react";

/**
 * Marcă pentru header: contur inimă + inimioare în interior (vizibile la dimensiuni mici).
 * Culoare: `currentColor` din părinte (ex. lângă DiebelWordmark).
 */
const HEART_D =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/** Cluster sus + câteva în interior (similar conceptului brand). */
const MINI_FILLS: { tx: number; ty: number; sc: number; opacity: number }[] = [
  { tx: 12, ty: 7.2, sc: 0.28, opacity: 0.95 },
  { tx: 9.5, ty: 8.8, sc: 0.22, opacity: 0.88 },
  { tx: 14.5, ty: 8.8, sc: 0.22, opacity: 0.88 },
  { tx: 7.2, ty: 10.2, sc: 0.18, opacity: 0.78 },
  { tx: 16.8, ty: 10.2, sc: 0.18, opacity: 0.78 },
  { tx: 12, ty: 10.8, sc: 0.24, opacity: 0.92 },
  { tx: 10.2, ty: 12.8, sc: 0.2, opacity: 0.82 },
  { tx: 13.8, ty: 12.8, sc: 0.2, opacity: 0.82 },
  { tx: 12, ty: 14.6, sc: 0.2, opacity: 0.85 },
  { tx: 9.8, ty: 16.2, sc: 0.16, opacity: 0.72 },
  { tx: 14.2, ty: 16.2, sc: 0.16, opacity: 0.72 },
  { tx: 12, ty: 18, sc: 0.14, opacity: 0.68 },
];

export function DiebelHeaderMark({ className = "" }: { className?: string }) {
  const rid = useId().replace(/:/g, "");
  const pathId = `diebel-hm-${rid}`;
  const size = className.trim() ? className.trim() : "h-7 w-7 sm:h-8 sm:w-8";

  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${size}`.trim()}
      aria-hidden
    >
      <defs>
        <path id={pathId} d={HEART_D} />
      </defs>
      {MINI_FILLS.map((m, i) => (
        <use
          key={i}
          href={`#${pathId}`}
          fill="currentColor"
          stroke="none"
          opacity={m.opacity}
          transform={`translate(${m.tx} ${m.ty}) scale(${m.sc}) translate(-12 -10.6)`}
        />
      ))}
      <path
        d={HEART_D}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.15}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.95}
      />
    </svg>
  );
}
