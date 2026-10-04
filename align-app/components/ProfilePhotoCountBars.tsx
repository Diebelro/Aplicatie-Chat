"use client";

/** Linii sus pe poză: câte poze, atâtea segmente; 0 poze = nimic. Un singur rând. */
export function ProfilePhotoCountBars({
  count,
  activeIndex = 0,
  compact = false,
  onSelect,
  insetClassName,
}: {
  count: number;
  activeIndex?: number;
  /** Carduri mici (grilă profiluri). */
  compact?: boolean;
  onSelect?: (index: number) => void;
  /** Override poziție (ex. loc pentru butoane pe cartonul de swipe). */
  insetClassName?: string;
}) {
  if (count <= 0) return null;
  const safeActive = Math.min(Math.max(0, activeIndex), count - 1);
  const interactive = typeof onSelect === "function";
  const inset =
    insetClassName ??
    (compact ? "top-1.5 left-1.5 right-1.5" : "top-2.5 left-3 right-3");

  return (
    <>
      <div
        className={`absolute inset-x-0 top-0 z-[1] pointer-events-none bg-gradient-to-b from-black/55 to-transparent ${
          compact ? "h-8" : "h-14"
        }`}
        aria-hidden
      />
      <div
        className={`absolute z-[2] flex gap-0.5 pointer-events-none ${inset}`}
        aria-hidden={!interactive}
      >
        {Array.from({ length: count }, (_, i) => {
          const active = i === safeActive;
          const bar = (
            <span
              className={`block w-full rounded-full ${
                active
                  ? compact
                    ? "h-[2.5px] bg-white shadow-[0_0_5px_rgba(255,255,255,0.85)]"
                    : "h-[3.5px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  : compact
                    ? "h-[2px] bg-white/35"
                    : "h-[2.5px] bg-white/35"
              }`}
            />
          );
          if (!interactive) {
            return (
              <span key={i} className="min-w-0 flex-1 flex items-center">
                {bar}
              </span>
            );
          }
          return (
            <button
              key={i}
              type="button"
              className="pointer-events-auto min-w-0 flex-1 h-3 flex items-center touch-manipulation"
              aria-label={`${i + 1} / ${count}`}
              aria-current={active ? "true" : undefined}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(i);
              }}
            >
              {bar}
            </button>
          );
        })}
      </div>
    </>
  );
}
