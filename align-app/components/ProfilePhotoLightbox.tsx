"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function touchDistance(t: { clientX: number; clientY: number }[]) {
  if (t.length < 2) return 0;
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

export function ProfilePhotoLightbox({
  portalReady,
  photos,
  index,
  setIndex,
  tStr,
}: {
  portalReady: boolean;
  photos: string[];
  index: number | null;
  setIndex: (i: number | null) => void;
  tStr: (key: string) => string;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  scaleRef.current = scale;
  const pinchRef = useRef<{ initialDist: number; initialScale: number } | null>(null);
  const panTouchRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const resetTransform = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetTransform();
    pinchRef.current = null;
    panTouchRef.current = null;
  }, [index, resetTransform]);

  useEffect(() => {
    if (scale <= 1.02) setPan({ x: 0, y: 0 });
  }, [scale]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || index == null) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.085 : 1 / 1.085;
      setScale((s) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s * factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [index]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = touchDistance([e.touches[0], e.touches[1]]);
      pinchRef.current = { initialDist: d || 1, initialScale: scaleRef.current };
      panTouchRef.current = null;
    } else if (e.touches.length === 1 && scale > 1.02) {
      const t = e.touches[0];
      panTouchRef.current = { sx: t.clientX, sy: t.clientY, px: pan.x, py: pan.y };
      pinchRef.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = touchDistance([e.touches[0], e.touches[1]]);
      const ratio = d / pinchRef.current.initialDist;
      setScale(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.initialScale * ratio)));
    } else if (e.touches.length === 1 && panTouchRef.current) {
      e.preventDefault();
      const t = e.touches[0];
      setPan({
        x: panTouchRef.current.px + (t.clientX - panTouchRef.current.sx),
        y: panTouchRef.current.py + (t.clientY - panTouchRef.current.sy),
      });
    }
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
    panTouchRef.current = null;
  };

  const onMouseDownPane = (e: React.MouseEvent) => {
    if (e.button !== 0 || scale <= 1.02) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const px = pan.x;
    const py = pan.y;
    const onMove = (ev: MouseEvent) => {
      setPan({ x: px + ev.clientX - startX, y: py + ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onDoubleClickPane = () => {
    setScale((s) => {
      if (s > 1.02) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  };

  useEffect(() => {
    if (index == null) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, setIndex]);

  if (!portalReady || index == null || !photos[index]) return null;

  const src = photos[index];

  return createPortal(
    <div
      className="fixed inset-0 z-[215] flex flex-col bg-zinc-950 max-h-[100dvh] h-[100dvh] overflow-hidden overscroll-none touch-none"
      role="dialog"
      aria-modal="true"
      aria-label={tStr("pages.userPublic.galleryAria")}
    >
      <div
        className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 bg-zinc-950/90 px-2 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/75
          pt-[max(0.5rem,env(safe-area-inset-top))] pb-2
          pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]"
      >
        <button
          type="button"
          className="flex items-center gap-1 rounded-full p-2.5 pr-3 text-white hover:bg-white/10 transition min-h-[44px]"
          aria-label={tStr("pages.userPublic.photoLightboxBack")}
          onClick={() => setIndex(null)}
        >
          <ChevronLeft className="w-7 h-7 shrink-0" aria-hidden />
          <span className="text-sm font-medium">{tStr("pages.userPublic.photoLightboxBack")}</span>
        </button>
        {photos.length > 1 && (
          <span className="ml-auto text-white/60 text-sm tabular-nums pr-1">
            {index + 1} / {photos.length}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 min-w-0 relative">
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="absolute z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-25 sm:left-3
                left-[max(0.35rem,env(safe-area-inset-left,0px))]
                top-1/2 -translate-y-1/2"
              aria-label={tStr("pages.userPublic.prevPhoto")}
              disabled={index <= 0}
              onClick={() => setIndex(index > 0 ? index - 1 : index)}
            >
              <ChevronLeft className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>
            <button
              type="button"
              className="absolute z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-25 sm:right-3
                right-[max(0.35rem,env(safe-area-inset-right,0px))]
                top-1/2 -translate-y-1/2"
              aria-label={tStr("pages.userPublic.nextPhoto")}
              disabled={index >= photos.length - 1}
              onClick={() => setIndex(index < photos.length - 1 ? index + 1 : index)}
            >
              <ChevronRight className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>
          </>
        )}

        <div
          ref={viewportRef}
          className={`absolute inset-0 flex items-center justify-center px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 select-none ${
            scale > 1.02 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          onMouseDown={onMouseDownPane}
          onDoubleClick={onDoubleClickPane}
        >
          <div
            className="relative flex h-full w-full max-h-full max-w-full items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "center center",
              willChange: scale > 1.02 || pan.x !== 0 || pan.y !== 0 ? "transform" : "auto",
            }}
          >
            <div className="relative mx-auto flex h-full w-full max-h-full max-w-[min(100dvw,100dvh)] items-center justify-center">
              <OptimizedImage
                src={src}
                alt=""
                fill
                className="object-contain object-center pointer-events-none"
                sizes="(max-width: 1280px) 100vw, 1280px"
                quality={92}
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
