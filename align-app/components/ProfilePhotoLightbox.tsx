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
      className="fixed inset-0 z-[215] flex flex-col bg-black max-h-[100dvh] h-[100dvh] overflow-hidden overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label={tStr("pages.userPublic.galleryAria")}
    >
      <div
        className={`shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 px-2 bg-black border-b border-white/10
          pt-[max(0.5rem,env(safe-area-inset-top))] pb-2`}
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
          <span className="ml-auto text-white/60 text-sm tabular-nums pr-2">
            {index + 1} / {photos.length}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 text-white border border-white/15 disabled:opacity-25"
              aria-label={tStr("pages.userPublic.prevPhoto")}
              disabled={index <= 0}
              onClick={() => setIndex(index > 0 ? index - 1 : index)}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/60 text-white border border-white/15 disabled:opacity-25"
              aria-label={tStr("pages.userPublic.nextPhoto")}
              disabled={index >= photos.length - 1}
              onClick={() => setIndex(index < photos.length - 1 ? index + 1 : index)}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        )}

        <div
          ref={viewportRef}
          className={`absolute inset-x-0 top-0 bottom-0 px-1 sm:px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] select-none ${
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
            className="w-full h-full flex items-start justify-center overflow-visible"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            <div className="relative h-full w-full min-h-0">
              <OptimizedImage
                src={src}
                alt=""
                fill
                className="object-contain object-top pointer-events-none"
                sizes="100vw"
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
