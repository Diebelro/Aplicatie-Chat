"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Phone, PhoneOff } from "lucide-react";
import { getAuthHeaders, fetchWithAuthRetry } from "@/lib/authClient";
import { markIncomingCallDismissed, shouldIgnorePolledIncoming } from "@/lib/callIncomingDismiss";
import {
  INCOMING_GRACE_LOCAL_STORAGE_KEY,
  isIncomingGraced,
  markIncomingGrace,
  POST_HANGUP_INCOMING_GRACE_MS,
} from "@/lib/callIncomingGrace";
import { closeIncomingCallPushNotifications } from "@/lib/closeIncomingCallPushNotifications";
import { markCallEndPosted, shouldSkipDuplicateCallEnd } from "@/lib/callEndDedup";
import { CALL_POLL_429_BACKOFF_MS } from "@/lib/callOutgoingConstants";
import { startIncomingRingtone, stopIncomingRingtone } from "@/lib/callRingtone";
import { isBrowserPushPrimaryPath } from "@/lib/browserPushConstants";
import { useCallRoomTranslate } from "@/lib/i18n/callTranslateSafe";
import { resolveCallDisplayedError, type CallErrorPayload } from "@/lib/i18n/callApiErrorMap";

/**
 * Soneria „incoming” e înainte de join în camera WebRTC — nu folosește `callState` din `useWebRtcCall`
 * (FSM-ul acoperă apelul activ după ce ești în cameră; `CallUI` citește `callState`).
 */

/** Filă activă: poll mai des ca „te sună” să apară repede când celălalt sună de pe telefon. */
const POLL_MS_VISIBLE = 800;
/** Filă în fundal: mai rare ca să nu omoare bateria; la revenire facem fetch imediat. */
const POLL_MS_HIDDEN = 5000;
/**
 * Cu Web Push marcat „primar”, evităm poll-ul agresiv — dar push-ul poate să nu livreze (tab deschis, permisiuni).
 * Un poll lent păstrează UX-ul „te sună” fără să depindem 100% de notificare.
 */
const POLL_MS_PUSH_FALLBACK_VISIBLE = 10_000;
const POLL_MS_PUSH_FALLBACK_HIDDEN = 20_000;

interface IncomingCallData {
  fromId: string;
  fromName: string;
  roomId: string;
  audioOnly: boolean;
  /** ISO — unic per ring (server); lipsă la răspunsuri vechi. */
  pendingSince?: string;
}

export default function IncomingCall() {
  const router = useRouter();
  const pathname = usePathname();
  const callT = useCallRoomTranslate();
  /** Pe pagina de apel nu mai arătăm overlay / sunet — evită „sună continuu” după Răspunde. */
  const onCallPage = pathname?.startsWith("/app/call") ?? false;

  const [incoming, setIncoming] = useState<IncomingCallData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Browserul blochează audio până la un gest — indicăm discret utilizatorului. */
  const [ringNeedsTap, setRingNeedsTap] = useState(false);
  /** În browser `window.setTimeout` → number; `ReturnType<typeof setTimeout>` cu @types/node → Timeout și pică build-ul Vercel. */
  const pollTimerRef = useRef<number | null>(null);
  /** Evită dublarea lanțului reject→end la dublu-tap pe Respinge. */
  const declineInFlightRef = useRef(false);
  const incomingRef = useRef<IncomingCallData | null>(null);
  incomingRef.current = incoming;
  /** Evită „soneria pornește din nou”: poll-ul poate întoarce `null` o clipă apoi același apel — debounce la golire. */
  const clearIncomingDebounceRef = useRef<number | null>(null);
  /** După 429 pe `/api/call/incoming`: nu mai cerem imediat (aliniat cu poll apelant). */
  const incoming429UntilRef = useRef(0);

  const cancelScheduledClearIncoming = useCallback(() => {
    if (clearIncomingDebounceRef.current != null) {
      window.clearTimeout(clearIncomingDebounceRef.current);
      clearIncomingDebounceRef.current = null;
    }
  }, []);

  const fetchIncoming = useCallback(() => {
    if (Date.now() < incoming429UntilRef.current) return;
    void fetchWithAuthRetry("/api/call/incoming", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })
      .then(async (r) => {
        /** 401 / 429: nu interpretăm corpul — evită golire UI pe JSON de eroare. */
        if (r.status === 401) return null;
        if (r.status === 429) {
          incoming429UntilRef.current = Date.now() + CALL_POLL_429_BACKOFF_MS;
          return null;
        }
        if (!r.ok) return null;
        incoming429UntilRef.current = 0;
        try {
          return await r.json();
        } catch {
          return null;
        }
      })
      .then((d) => {
        if (!d || typeof d !== "object") return;
        const inc = (d as { incoming?: IncomingCallData | null }).incoming as IncomingCallData | null | undefined;
        /** Part 2.2: grace înainte de UI/sonerie — apoi dismiss explicit (shouldIgnore) cu extindere grace. */
        if (inc?.roomId && isIncomingGraced(inc.roomId, inc.pendingSince)) {
          cancelScheduledClearIncoming();
          stopIncomingRingtone();
          setRingNeedsTap(false);
          setIncoming(null);
          void fetch("/api/call/end", {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ roomId: inc.roomId }),
          }).catch(() => {});
          return;
        }
        if (inc?.roomId && shouldIgnorePolledIncoming(inc.roomId, inc.pendingSince)) {
          cancelScheduledClearIncoming();
          markIncomingGrace(inc.roomId, inc.pendingSince, 12000);
          stopIncomingRingtone();
          setRingNeedsTap(false);
          setIncoming(null);
          void fetch("/api/call/end", {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ roomId: inc.roomId }),
          }).catch(() => {});
          return;
        }
        if (inc) {
          cancelScheduledClearIncoming();
          setIncoming((prev) => {
            if (
              prev &&
              prev.roomId === inc.roomId &&
              prev.pendingSince === inc.pendingSince &&
              prev.fromId === inc.fromId &&
              prev.audioOnly === inc.audioOnly &&
              prev.fromName === inc.fromName
            ) {
              return prev;
            }
            return inc;
          });
          return;
        }
        if (clearIncomingDebounceRef.current != null) return;
        /** Mai lung decât poll-ul vizibil (~800ms): evită „clip” null→același apel→sonerie de la capăt. */
        clearIncomingDebounceRef.current = window.setTimeout(() => {
          clearIncomingDebounceRef.current = null;
          setIncoming(null);
        }, 1600);
      })
      .catch(() => {});
  }, [cancelScheduledClearIncoming]);

  useEffect(() => {
    if (onCallPage) {
      cancelScheduledClearIncoming();
      incoming429UntilRef.current = 0;
      setIncoming(null);
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const clearPoll = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    /**
     * Cu Web Push activ folosim poll lent de siguranță; fără push rămâne poll-ul mai des.
     */
    const scheduleAfterFetchCycle = () => {
      if (cancelled) return;
      const baseMs = isBrowserPushPrimaryPath()
        ? typeof document !== "undefined" && document.visibilityState === "visible"
          ? POLL_MS_PUSH_FALLBACK_VISIBLE
          : POLL_MS_PUSH_FALLBACK_HIDDEN
        : typeof document !== "undefined" && document.visibilityState === "visible"
          ? POLL_MS_VISIBLE
          : POLL_MS_HIDDEN;
      const wait429 = Math.max(0, incoming429UntilRef.current - Date.now());
      const ms = wait429 > 0 ? Math.max(baseMs, wait429) : baseMs;
      pollTimerRef.current = window.setTimeout(() => {
        fetchIncoming();
        scheduleAfterFetchCycle();
      }, ms);
    };

    fetchIncoming();
    scheduleAfterFetchCycle();

    const bumpIncoming = () => {
      fetchIncoming();
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        clearPoll();
        scheduleAfterFetchCycle();
      }
    };

    const onVisibility = () => {
      bumpIncoming();
    };

    window.addEventListener("focus", bumpIncoming);
    window.addEventListener("pageshow", bumpIncoming);
    window.addEventListener("online", bumpIncoming);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearPoll();
      cancelScheduledClearIncoming();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", bumpIncoming);
      window.removeEventListener("pageshow", bumpIncoming);
      window.removeEventListener("online", bumpIncoming);
    };
  }, [fetchIncoming, onCallPage, cancelScheduledClearIncoming]);

  /** Alt tab / WebView marchează grace în localStorage — oprește soneria și realiniază poll fără întârziere. */
  useEffect(() => {
    if (typeof window === "undefined" || onCallPage) return;
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== INCOMING_GRACE_LOCAL_STORAGE_KEY) return;
      const cur = incomingRef.current;
      if (cur?.roomId && isIncomingGraced(cur.roomId, cur.pendingSince)) {
        cancelScheduledClearIncoming();
        stopIncomingRingtone();
        setRingNeedsTap(false);
        setIncoming(null);
        void fetch("/api/call/end", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ roomId: cur.roomId }),
        }).catch(() => {});
      }
      fetchIncoming();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fetchIncoming, onCallPage, cancelScheduledClearIncoming]);

  useEffect(() => {
    if (!incoming?.roomId) return;
    closeIncomingCallPushNotifications(incoming.roomId);
  }, [incoming?.roomId]);

  useEffect(() => {
    if (onCallPage || !incoming) {
      stopIncomingRingtone();
      setRingNeedsTap(false);
      return;
    }
    /** Guard: starea poate fi inconsistentă scurt (race / alt tab); nu porni soneria dacă e deja graced. */
    if (isIncomingGraced(incoming.roomId, incoming.pendingSince)) {
      stopIncomingRingtone();
      setRingNeedsTap(false);
      void fetch("/api/call/end", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ roomId: incoming.roomId }),
      }).catch(() => {});
      setIncoming(null);
      return;
    }
    const { resume, needsUserGesture } = startIncomingRingtone();
    setRingNeedsTap(needsUserGesture);
    void resume();

    const unlock = () => {
      void resume();
      setRingNeedsTap(false);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      stopIncomingRingtone();
      setRingNeedsTap(false);
    };
  }, [incoming?.roomId, incoming?.pendingSince, onCallPage]);

  /** Back browser cât e overlay „te sună”: respinge pe server ca să nu reapară la următorul back. */
  useEffect(() => {
    if (onCallPage || !incoming) return;
    const roomId = incoming.roomId;
    const onPopState = () => {
      const cur = incomingRef.current;
      if (!cur || cur.roomId !== roomId) return;
      cancelScheduledClearIncoming();
      markIncomingCallDismissed(cur.roomId, cur.pendingSince);
      markIncomingGrace(cur.roomId, cur.pendingSince, 12000);
      void fetch("/api/call/end", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ roomId: cur.roomId }),
      }).catch(() => {});
      setIncoming(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [incoming?.roomId, onCallPage, cancelScheduledClearIncoming]);

  /**
   * Fără reject la unmount: navigarea /app → /admin, /login etc. demonta layout-ul și respingea apelul
   * fără acțiunea utilizatorului. Respingerea rămâne doar la Respinge, Back și popstate.
   */

  const handleAnswer = () => {
    if (!incoming || loading) return;
    setActionError(null);
    setLoading(true);
    stopIncomingRingtone();
    setRingNeedsTap(false);
    fetch("/api/call/accept", {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "same-origin",
    })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as CallErrorPayload & { roomId?: string; audioOnly?: boolean };
        if (!r.ok) {
          setActionError(resolveCallDisplayedError(d, callT.tStr));
          return;
        }
        if (d.roomId) {
          const q = d.audioOnly ? "?audio=1" : "";
          /** După accept, serverul curăță pending; marchează local ca să nu reapară overlay la poll între navigări. */
          markIncomingCallDismissed(d.roomId, incoming.pendingSince);
          markIncomingGrace(d.roomId, incoming.pendingSince, POST_HANGUP_INCOMING_GRACE_MS);
          /** Nu setIncoming(null) înainte de navigare — altfel dispare overlay-ul și se vede o clipă pagina de dedesubt (ex. mesaje). */
          router.push(`/app/call/${d.roomId}${q}`);
        } else {
          setActionError(callT.tStr("pages.callRoom.incomingOverlay.acceptErrorOpen"));
        }
      })
      .catch(() => setActionError(callT.tStr("pages.callRoom.incomingOverlay.acceptErrorNetwork")))
      .finally(() => setLoading(false));
  };

  const handleDecline = () => {
    if (!incoming || loading || declineInFlightRef.current) return;
    declineInFlightRef.current = true;
    setActionError(null);
    setLoading(true);
    cancelScheduledClearIncoming();
    stopIncomingRingtone();
    setRingNeedsTap(false);
    markIncomingGrace(incoming.roomId, incoming.pendingSince, 12000);
    markIncomingCallDismissed(incoming.roomId, incoming.pendingSince);
    const roomId = incoming.roomId;
    setIncoming(null);
    /**
     * IMPORTANT: întâi POST /reject cu roomId (marchează respins cât încă există pending), apoi POST /end.
     * Dacă trimiți /end înainte, pending-ul dispare și /reject nu mai poate marca respins.
     */
    fetch("/api/call/reject", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ roomId }),
    })
      .then(async (r) => {
        if (!r.ok) return;
        if (shouldSkipDuplicateCallEnd(roomId)) return;
        markCallEndPosted(roomId);
        void fetch("/api/call/end", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ roomId }),
        }).catch(() => {});
      })
      .finally(() => {
        declineInFlightRef.current = false;
        setLoading(false);
      });
  };

  if (onCallPage || !incoming) return null;

  const displayName =
    incoming.fromName.trim() !== "" ? incoming.fromName : callT.tStr("pages.callRoom.fallbackUserName");

  return (
    <div className="fixed inset-0 z-[220] flex flex-col items-center justify-center bg-night-900 min-h-screen p-6">
      <p className="text-night-400 text-base mb-2">
        {incoming.audioOnly
          ? callT.tStr("pages.callRoom.incomingOverlay.audioCall")
          : callT.tStr("pages.callRoom.incomingOverlay.videoCall")}
      </p>
      <p className="text-2xl md:text-3xl font-semibold text-white mb-2 text-center">{displayName}</p>
      <p className="text-lg text-night-400 mb-8">{callT.tStr("pages.callRoom.incomingOverlay.ringingSubtitle")}</p>
      {ringNeedsTap && (
        <p className="text-night-500 text-sm text-center max-w-sm mb-4 px-2">
          {callT.tStr("pages.callRoom.incomingOverlay.tapForRingtone")}
        </p>
      )}
      {actionError && (
        <p className="text-amber-400 text-sm text-center max-w-sm mb-6 px-2" role="alert">
          {actionError}
        </p>
      )}
      <div className="flex gap-8 justify-center flex-wrap">
        <button
          type="button"
          onClick={handleDecline}
          disabled={loading}
          className="flex flex-col items-center gap-3 px-8 py-5 rounded-full bg-red-500/25 text-red-400 hover:bg-red-500/35 transition disabled:opacity-50 min-w-[140px]"
        >
          <PhoneOff className="w-12 h-12" />
          <span className="text-base font-medium">{callT.tStr("pages.callRoom.incomingOverlay.decline")}</span>
        </button>
        <button
          type="button"
          onClick={handleAnswer}
          disabled={loading}
          className="flex flex-col items-center gap-3 px-8 py-5 rounded-full bg-green-500/25 text-green-400 hover:bg-green-500/35 transition disabled:opacity-50 min-w-[140px]"
        >
          <Phone className="w-12 h-12" />
          <span className="text-base font-medium">{callT.tStr("pages.callRoom.incomingOverlay.answer")}</span>
        </button>
      </div>
      <p className="mt-10 text-center">
        <Link
          href="/app/missed-calls"
          className="text-sm text-night-500 hover:text-brand-400 underline underline-offset-2"
        >
          {callT.tStr("pages.callRoom.incomingOverlay.missedCallsLink")}
        </Link>
      </p>
    </div>
  );
}
