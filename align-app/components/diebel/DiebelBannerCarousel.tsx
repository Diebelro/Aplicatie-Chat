"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DiebelBannerPulse } from "./DiebelBannerPulse";
import { DiebelBannerFlash } from "./DiebelBannerFlash";
import { DiebelBannerNextWave } from "./DiebelBannerNextWave";

const SLIDES = [
  { id: "pulse", Component: DiebelBannerPulse, label: "Diebel — slide 1 din 3" },
  { id: "flash", Component: DiebelBannerFlash, label: "Diebel — slide 2 din 3" },
  { id: "nextwave", Component: DiebelBannerNextWave, label: "Diebel — slide 3 din 3" },
] as const;

export type DiebelBannerCarouselProps = {
  autoRotate?: boolean;
  intervalMs?: number;
  showDots?: boolean;
  compact?: boolean;
  className?: string;
};

/**
 * Carousel DIEBEL în zona de publicitate: fade 400ms, 4s, buline.
 * Înălțime premium (Tinder-style strip), varianta compact pentru feed.
 */
export function DiebelBannerCarousel({
  autoRotate = true,
  intervalMs = 4000,
  showDots = true,
  compact = false,
  className = "",
}: DiebelBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!autoRotate || reducedMotion) return;
    const t = window.setInterval(() => {
      setIndex((p) => (p + 1) % SLIDES.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [autoRotate, intervalMs, reducedMotion]);

  const go = useCallback((dir: -1 | 1) => {
    setIndex((p) => (p + dir + SLIDES.length) % SLIDES.length);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx > 40) go(-1);
    else if (dx < -40) go(1);
  };

  const stripH = compact
    ? "min-h-[172px] h-[172px] sm:min-h-[188px] sm:h-[188px]"
    : "min-h-[212px] h-[212px] sm:min-h-[232px] sm:h-[232px] md:min-h-[248px] md:h-[248px]";

  return (
    <div
      className={`relative w-full max-w-full select-none ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/30 shadow-md shadow-black/50 sm:rounded-2xl">
        <div className={`relative w-full ${stripH}`}>
          {SLIDES.map(({ id, Component }, idx) => (
            <div
              key={id}
              className={`absolute inset-0 transition-opacity duration-[400ms] ease-out motion-reduce:transition-none ${
                idx === index ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none"
              }`}
              aria-hidden={idx !== index}
            >
              <Component
                compact={compact}
                className="!min-h-0 h-full min-h-full rounded-none"
                textAnimationClass={
                  idx === index
                    ? idx === 0
                      ? "animate-diebelFadeUp"
                      : idx === 1
                        ? "animate-diebelSlideLeft"
                        : "animate-diebelScaleIn"
                    : ""
                }
              />
            </div>
          ))}
        </div>
      </div>
      {showDots && (
        <div className="mt-2 flex justify-center gap-2.5" role="tablist" aria-label="Bannere DIEBEL">
          {SLIDES.map((s, d) => {
            const active =
              d === index
                ? d === 0
                  ? "w-6 bg-amber-200/85"
                  : d === 1
                    ? "w-6 bg-orange-300/85"
                    : "w-6 bg-violet-300/80"
                : "w-1.5 bg-zinc-600/60 hover:bg-zinc-500/70";
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={d === index}
                aria-label={`${s.label}, slide ${d + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${active}`}
                onClick={() => setIndex(d)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
