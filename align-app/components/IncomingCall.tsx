"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Phone, PhoneOff } from "lucide-react";
import { getAuthHeaders, fetchWithAuthRetry } from "@/lib/authClient";
import { markIncomingCallDismissed, shouldIgnorePolledIncoming } from "@/lib/callIncomingDismiss";
import {
  clearIncomingGrace,
  isIncomingGraced,
  markIncomingGrace,
} from "@/lib/callIncomingGrace";
import { closeIncomingCallPushNotifications } from "@/lib/closeIncomingCallPushNotifications";
import { markCallEndPosted, shouldSkipDuplicateCallEnd } from "@/lib/callEndDedup";
import { startIncomingRingtone, stopIncomingRingtone } from "@/lib/callRingtone";
import { isBrowserPushPrimaryPath } from "@/lib/browserPushConstants";

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

  const cancelScheduledClearIncoming = useCallback(() => {
    if (clearIncomingDebounceRef.current != null) {
      window.clearTimeout(clearIncomingDebounceRef.current);
      clearIncomingDebounceRef.current = null;
    }
  }, []);

  const fetchIncoming = useCallback(() => {
    void fetchWithAuthRetry("/api/call/incoming", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })
      .then(async (r) => {
        /** 401: nu reseta overlay — poate cursă cookie/header după login sau schimbare tab; următorul poll reușește. */
        if (r.status === 401) return null;
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
        clearIncomingDebounceRef.current = window.setTimeout(() => {
          clearIncomingDebounceRef.current = null;
          setIncoming(null);
        }, 500);
      })
      .catch(() => {});
  }, [cancelScheduledClearIncoming]);

  useEffect(() => {
    if (onCallPage) {
      cancelScheduledClearIncoming();
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
      const ms = isBrowserPushPrimaryPath()
        ? typeof document !== "undefined" && document.visibilityState === "visible"
          ? POLL_MS_PUSH_FALLBACK_VISIBLE
          : POLL_MS_PUSH_FALLBACK_HIDDEN
        : typeof document !== "undefined" && document.visibilityState === "visible"
          ? POLL_MS_VISIBLE
          : POLL_MS_HIDDEN;
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
    fetch("/api/call/accept", {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "same-origin",
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setActionError((d.error as string) || `Eroare ${r.status}. Încearcă din nou.`);
          return;
        }
        if (d.roomId) {
          const q = d.audioOnly ? "?audio=1" : "";
          clearIncomingGrace(d.roomId);
          /** După accept, serverul curăță pending; marchează local ca să nu reapară overlay la poll între navigări. */
          markIncomingCallDismissed(d.roomId, incoming.pendingSince);
          /** Nu setIncoming(null) înainte de navigare — altfel dispare overlay-ul și se vede o clipă pagina de dedesubt (ex. mesaje). */
          router.push(`/app/call/${d.roomId}${q}`);
        } else {
          setActionError("Nu s-a putut deschide apelul. Reîncearcă.");
        }
      })
      .catch(() => setActionError("Eroare rețea. Verifică conexiunea."))
      .finally(() => setLoading(false));
  };

  const handleDecline = () => {
    if (!incoming || loading || declineInFlightRef.current) return;
    declineInFlightRef.current = true;
    setActionError(null);
    setLoading(true);
    cancelScheduledClearIncoming();
    markIncomingGrace(incoming.roomId, incoming.pendingSince, 12000);
    markIncomingCallDismissed(incoming.roomId, incoming.pendingSince);
    const roomId = incoming.roomId;
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
        setIncoming(null);
      });
  };

  if (onCallPage || !incoming) return null;

  return (
    <div className="fixed inset-0 z-[220] flex flex-col items-center justify-center bg-night-900 min-h-screen p-6">
      <p className="text-night-400 text-base mb-2">
        {incoming.audioOnly ? "Apel audio" : "Apel video"}
      </p>
      <p className="text-2xl md:text-3xl font-semibold text-white mb-2 text-center">
        {incoming.fromName}
      </p>
      <p className="text-lg text-night-400 mb-8">te sună</p>
      {ringNeedsTap && (
        <p className="text-night-500 text-sm text-center max-w-sm mb-4 px-2">
          Apasă oriunde pe ecran ca să se audă soneria (blocaj browser).
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
          <span className="text-base font-medium">Respinge</span>
        </button>
        <button
          type="button"
          onClick={handleAnswer}
          disabled={loading}
          className="flex flex-col items-center gap-3 px-8 py-5 rounded-full bg-green-500/25 text-green-400 hover:bg-green-500/35 transition disabled:opacity-50 min-w-[140px]"
        >
          <Phone className="w-12 h-12" />
          <span className="text-base font-medium">Răspunde</span>
        </button>
      </div>
      <p className="mt-10 text-center">
        <Link
          href="/app/missed-calls"
          className="text-sm text-night-500 hover:text-brand-400 underline underline-offset-2"
        >
          Vezi apeluri pierdute
        </Link>
      </p>
    </div>
  );
}
