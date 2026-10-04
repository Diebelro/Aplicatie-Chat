"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Phone } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { getVideoRoomId } from "@/lib/videoCall";
import { clientHangupCall } from "@/lib/callHangupClient";
import type { RingNotifySnapshot } from "@/lib/callRingNotifySnapshot";
import { RING_PUSH_HINT_SESSION_KEY, getRingNotifyHintKey } from "@/lib/callRingNotifySnapshot";
import { useCallRoomTranslate } from "@/lib/i18n/callTranslateSafe";
import { resolveCallDisplayedError } from "@/lib/i18n/callApiErrorMap";

async function resolveMyIdForCall(): Promise<string | null> {
  const raw = getStoredUserRaw();
  if (raw) {
    try {
      const u = JSON.parse(raw) as User;
      const id = u?.id != null ? String(u.id).trim() : "";
      if (id) return id;
    } catch {
      /* ignore */
    }
  }
  const r = await fetchWithAuthRetry("/api/me", { cache: "no-store" });
  if (!r.ok) return null;
  const d = await r.json();
  const id = d?.user?.id != null ? String(d.user.id).trim() : "";
  return id || null;
}

type QuickCallButtonsProps = {
  toUserId: string;
  /** sm = listă Mesaje (stivuite); md = rând; toolbar = compact pe card Profile; discover = rotunde */
  size?: "sm" | "md" | "toolbar" | "discover";
  className?: string;
};

/**
 * Video + Audio 1-la-1: ring + redirect la /app/call/[room].
 * Folosit în Mesaje, liste; nu propaga click către Link părinte.
 */
export function QuickCallButtons({ toUserId, size = "md", className = "" }: QuickCallButtonsProps) {
  const callT = useCallRoomTranslate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [callHint, setCallHint] = useState<string | null>(null);
  const liveRef = useRef(true);
  const ringTargetRef = useRef(toUserId);

  useLayoutEffect(() => {
    ringTargetRef.current = toUserId;
  }, [toUserId]);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  const retractRing = (roomId: string) => {
    void clientHangupCall({ roomId });
  };

  const start = async (audioOnly: boolean) => {
    if (busy || !toUserId) return;
    const targetAtStart = toUserId;
    setCallHint(null);
    const myId = await resolveMyIdForCall();
    if (!myId) {
      setCallHint(callT.tStr("pages.callRoom.quickCall.sessionLoadFailed"));
      return;
    }
    setBusy(true);
    let keepBusyUntilUnmount = false;
    const roomIdForRing = getVideoRoomId(myId, targetAtStart);
    const stillThisTarget = () => liveRef.current && ringTargetRef.current === targetAtStart;
    try {
      const res = await fetchWithAuthRetry("/api/call/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: targetAtStart, audioOnly }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; errorCode?: string };
        setCallHint(
          resolveCallDisplayedError(j, callT.tStr) || callT.tStr("pages.callRoom.quickCall.ringFailedGeneric")
        );
        return;
      }
      if (!stillThisTarget()) {
        retractRing(roomIdForRing);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { notify?: RingNotifySnapshot };
      const hintKey = getRingNotifyHintKey(j.notify);
      if (hintKey) {
        try {
          sessionStorage.setItem(RING_PUSH_HINT_SESSION_KEY, hintKey);
        } catch {
          /* ignore */
        }
      }
      if (!stillThisTarget()) {
        retractRing(roomIdForRing);
        return;
      }
      keepBusyUntilUnmount = true;
      router.push(`/app/call/${roomIdForRing}${audioOnly ? "?audio=1&from=ring" : "?from=ring"}`);
    } catch {
      setCallHint(callT.tStr("pages.callRoom.quickCall.networkError"));
    } finally {
      if (!keepBusyUntilUnmount) setBusy(false);
    }
  };

  const stopEvt = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const hintEl = callHint ? (
    <p className="text-amber-500/95 text-xs leading-snug max-w-[min(100%,260px)]" role="status">
      {callHint}
    </p>
  ) : null;

  if (size === "discover") {
    const discoverBtn =
      "aspect-square max-h-14 w-full rounded-full bg-dark-700 active:scale-95 flex items-center justify-center border transition touch-manipulation disabled:opacity-50";
    return (
      <>
        {callHint ? (
          <p className="sr-only" role="status">
            {callHint}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            stopEvt(e);
            void start(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`${discoverBtn} text-brand-400 border-brand-500/45 hover:bg-brand-500/20 ${className}`}
          title={callT.tStr("pages.callRoom.quickCall.titleVideo")}
          aria-label={callT.tStr("pages.callRoom.quickCall.titleVideo")}
        >
          <Video className="w-6 h-6" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            stopEvt(e);
            void start(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`${discoverBtn} text-sky-500 border-sky-500/45 hover:bg-sky-500/20`}
          title={callT.tStr("pages.callRoom.quickCall.titleAudio")}
          aria-label={callT.tStr("pages.callRoom.quickCall.titleAudio")}
        >
          <Phone className="w-6 h-6" />
        </button>
      </>
    );
  }

  // toolbar: butoanele intră în grid-ul părinte (display:contents) — carduri Profile.
  if (size === "toolbar") {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            stopEvt(e);
            void start(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-9 w-full items-center justify-center rounded-lg bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 border border-brand-500/35 transition touch-manipulation disabled:opacity-50 ${className}`}
          title={callT.tStr("pages.callRoom.quickCall.titleVideo")}
          aria-label={callT.tStr("pages.callRoom.quickCall.titleVideo")}
        >
          <Video className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            stopEvt(e);
            void start(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-9 w-full items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 border border-sky-500/40 transition touch-manipulation disabled:opacity-50"
          title={callT.tStr("pages.callRoom.quickCall.titleAudio")}
          aria-label={callT.tStr("pages.callRoom.quickCall.titleAudio")}
        >
          <Phone className="w-4 h-4" />
        </button>
        {callHint ? (
          <p className="col-span-6 text-amber-500/95 text-[10px] leading-snug" role="status">
            {callHint}
          </p>
        ) : null}
      </>
    );
  }

  // sm (listă Mesaje): stivuite pe verticală — lasă spațiu pentru nume/avatar pe telefon.
  const wrap = size === "sm" ? "flex-col gap-0.5" : "flex-row gap-1";
  const btn =
    size === "sm"
      ? "h-10 w-10 min-h-[40px] min-w-[40px] rounded-lg"
      : "app-touch-target rounded-lg";
  const icon = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <div className={`flex flex-col gap-1 min-w-0 shrink-0 ${className}`}>
      <div
        className={`flex items-center ${wrap}`}
        onClick={stopEvt}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="group"
        aria-label={callT.tStr("pages.callRoom.quickCall.ariaVideoAudio")}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => void start(false)}
          className={`flex items-center justify-center ${btn} bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 border border-brand-500/35 transition touch-manipulation disabled:opacity-50`}
          title={callT.tStr("pages.callRoom.quickCall.titleVideo")}
        >
          <Video className={icon} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void start(true)}
          className={`flex items-center justify-center ${btn} bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 border border-sky-500/40 transition touch-manipulation disabled:opacity-50`}
          title={callT.tStr("pages.callRoom.quickCall.titleAudio")}
        >
          <Phone className={icon} />
        </button>
      </div>
      {hintEl}
    </div>
  );
}
