"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
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
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const photosLenRef = useRef(photos.length);
  photosLenRef.current = photos.length;

  const resetTransform = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetTransform();
    pinchRef.current = null;
    panTouchRef.current = null;
    swipeRef.current = null;
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
      swipeRef.current = null;
    } else if (e.touches.length === 1 && scale > 1.02) {
      const t = e.touches[0];
      panTouchRef.current = { sx: t.clientX, sy: t.clientY, px: pan.x, py: pan.y };
      pinchRef.current = null;
      swipeRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      swipeRef.current = { x: t.clientX, y: t.clientY };
      pinchRef.current = null;
      panTouchRef.current = null;
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

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeRef.current;
    pinchRef.current = null;
    panTouchRef.current = null;
    swipeRef.current = null;
    if (!start || scaleRef.current > 1.02) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    const i = indexRef.current;
    const n = photosLenRef.current;
    if (i == null || n <= 1) return;
    if (dx < 0 && i < n - 1) setIndex(i + 1);
    else if (dx > 0 && i > 0) setIndex(i - 1);
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
      if (e.key === "Escape") {
        setIndex(null);
        return;
      }
      const i = indexRef.current;
      const n = photosLenRef.current;
      if (i == null || n <= 1 || scaleRef.current > 1.02) return;
      if (e.key === "ArrowLeft" && i > 0) setIndex(i - 1);
      if (e.key === "ArrowRight" && i < n - 1) setIndex(i + 1);
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
      className="fixed-safe-screen z-[215] flex flex-col bg-zinc-950 overflow-hidden overscroll-none touch-none"
      role="dialog"
      aria-modal="true"
      aria-label={tStr("pages.userPublic.galleryAria")}
    >
      <div
        className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 bg-zinc-950/90 px-2 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/75
          pt-[max(0.5rem,var(--safe-area-inset-top))] pb-2
          pl-[max(0.5rem,var(--safe-area-inset-left))] pr-[max(0.5rem,var(--safe-area-inset-right))]"
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
        <div
          ref={viewportRef}
          className={`absolute inset-0 flex items-center justify-center px-[max(0.75rem,var(--safe-area-inset-left))] pr-[max(0.75rem,var(--safe-area-inset-right))] pb-[max(0.75rem,var(--safe-area-inset-bottom))] pt-2 select-none ${
            scale > 1.02 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => {
            pinchRef.current = null;
            panTouchRef.current = null;
            swipeRef.current = null;
          }}
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
