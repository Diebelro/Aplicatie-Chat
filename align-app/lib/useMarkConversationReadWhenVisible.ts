import { useEffect, useRef, useCallback, type RefObject } from "react";
import { markConversationReadClient } from "@/lib/conversationReadClient";

/**
 * După ce rândul de conversație a fost suficient de timp în viewport, marchează citit
 * (badge lista + total header) fără a obliga deschiderea chatului.
 */
export function useMarkConversationReadWhenVisible(
  otherId: string,
  unreadCount: number,
  onMarked?: () => void,
  opts?: { threshold?: number; dwellMs?: number }
): RefObject<HTMLLIElement | null> {
  const ref = useRef<HTMLLIElement>(null);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threshold = opts?.threshold ?? 0.14;
  const dwellMs = opts?.dwellMs ?? 350;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    doneRef.current = false;
  }, [otherId]);

  useEffect(() => {
    if (unreadCount <= 0) {
      doneRef.current = true;
      return;
    }
    if (doneRef.current) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (doneRef.current) return;
        const e = entries[0];
        if (e.isIntersecting && e.intersectionRatio >= threshold) {
          if (timerRef.current == null) {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              if (doneRef.current) return;
              void markConversationReadClient(otherId).then((ok) => {
                if (ok) {
                  doneRef.current = true;
                  onMarked?.();
                }
              });
            }, dwellMs);
          }
        } else {
          clearTimer();
        }
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: [0, threshold, 0.45] }
    );
    obs.observe(el);
    return () => {
      clearTimer();
      obs.disconnect();
    };
  }, [otherId, unreadCount, threshold, dwellMs, clearTimer, onMarked]);

  return ref;
}
