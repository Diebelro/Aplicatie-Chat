"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Remote video: „renderabil” = <video> are videoWidth/Height > 0.
 * După true, rămâne true pentru același `stream` (fără overlay care palpează la mute/unmute pe track).
 */
export function useVideoRenderable(
  videoRef: RefObject<HTMLVideoElement | null>,
  stream: MediaStream | null | undefined
): boolean {
  const [ready, setReady] = useState(false);
  const doneRef = useRef(false);

  useLayoutEffect(() => {
    if (!stream) {
      setReady(false);
      doneRef.current = false;
      return;
    }

    setReady(false);
    doneRef.current = false;

    let cancelled = false;
    let rafWaitId = 0;
    let rafTickId = 0;
    const cleanupFns: Array<() => void> = [];
    let pollFrames = 0;
    let boundToEl = false;

    const tryPixels = (el: HTMLVideoElement) => {
      if (cancelled || doneRef.current) return;
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        doneRef.current = true;
        setReady(true);
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

      const tick = () => {
        if (cancelled || doneRef.current) return;
        tryPixels(el);
        rafTickId = requestAnimationFrame(tick);
      };
      rafTickId = requestAnimationFrame(tick);
      cleanupFns.push(() => cancelAnimationFrame(rafTickId));
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
      for (const fn of cleanupFns) fn();
    };
  }, [stream, videoRef]);

  return ready;
}
