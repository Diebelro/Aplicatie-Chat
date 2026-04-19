"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export type UseVideoRenderableOptions = {
  /** O singură dată când primul frame e gata (pixeli sau RVFC / readyState). */
  onFirstFrame?: () => void;
};

/**
 * Remote video: „renderabil” = <video> are videoWidth/Height > 0.
 * Opțional: `requestVideoFrameCallback` sau `readyState >= HAVE_CURRENT_DATA`.
 */
export function useVideoRenderable(
  videoRef: RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null | undefined,
  opts?: UseVideoRenderableOptions
): boolean {
  const [ready, setReady] = useState(false);
  const doneRef = useRef(false);
  const firstFrameCbFiredRef = useRef(false);
  const onFirstFrameRef = useRef(opts?.onFirstFrame);
  onFirstFrameRef.current = opts?.onFirstFrame;

  useLayoutEffect(() => {
    if (!stream) {
      setReady(false);
      doneRef.current = false;
      firstFrameCbFiredRef.current = false;
      return;
    }

    setReady(false);
    doneRef.current = false;
    firstFrameCbFiredRef.current = false;

    let cancelled = false;
    let rafWaitId = 0;
    let rafTickId = 0;
    let rvfcId = 0;
    let fallbackTimer: number | null = null;
    const cleanupFns: Array<() => void> = [];
    let pollFrames = 0;
    let boundToEl = false;

    const markReady = () => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      setReady(true);
      if (!firstFrameCbFiredRef.current) {
        firstFrameCbFiredRef.current = true;
        onFirstFrameRef.current?.();
      }
    };

    const tryPixels = (el: HTMLVideoElement) => {
      if (cancelled || doneRef.current) return;
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        markReady();
        return;
      }
      if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        markReady();
      }
    };

    const bindToEl = (el: HTMLVideoElement) => {
      if (boundToEl) return;
      boundToEl = true;
      const onLoaded = () => tryPixels(el);
      const onPlaying = () => tryPixels(el);
      el.addEventListener("loadeddata", onLoaded);
      el.addEventListener("playing", onPlaying);
      cleanupFns.push(() => {
        el.removeEventListener("loadeddata", onLoaded);
        el.removeEventListener("playing", onPlaying);
      });

      const elRvfc = el as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      if (typeof elRvfc.requestVideoFrameCallback === "function") {
        const step = () => {
          if (cancelled || doneRef.current) return;
          tryPixels(el);
          if (!doneRef.current) {
            rvfcId = elRvfc.requestVideoFrameCallback!(step);
          }
        };
        rvfcId = elRvfc.requestVideoFrameCallback!(step);
        cleanupFns.push(() => {
          if (rvfcId && typeof elRvfc.cancelVideoFrameCallback === "function") {
            try {
              elRvfc.cancelVideoFrameCallback(rvfcId);
            } catch {
              /* ignore */
            }
          }
        });
      }

      const tick = () => {
        if (cancelled || doneRef.current) return;
        tryPixels(el);
        rafTickId = requestAnimationFrame(tick);
      };
      rafTickId = requestAnimationFrame(tick);
      cleanupFns.push(() => cancelAnimationFrame(rafTickId));

      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null;
        if (!cancelled && !doneRef.current) tryPixels(el);
      }, 900);
    };

    const waitForEl = () => {
      if (cancelled || boundToEl) return;
      const el = videoRef.current;
      if (el) {
        bindToEl(el);
        return;
      }
      if (pollFrames++ > 120 || cancelled) return;
      rafWaitId = requestAnimationFrame(waitForEl);
    };

    waitForEl();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafWaitId);
      cancelAnimationFrame(rafTickId);
      if (fallbackTimer != null) clearTimeout(fallbackTimer);
      for (const fn of cleanupFns) fn();
    };
  }, [stream, videoRef]);

  return ready;
}
