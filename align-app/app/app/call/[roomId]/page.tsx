"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders, fetchWithAuthRetry } from "@/lib/authClient";
import { markIncomingCallDismissed } from "@/lib/callIncomingDismiss";
import { canAccessRoom, isConferenceRoomId } from "@/lib/videoCall";
import { displayName } from "@/lib/displayName";
import CallUI from "@/components/CallUI";

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = getStoredUserRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const audioOnly = searchParams.get("audio") === "1";
  const fromPush = searchParams.get("from") === "push";
  const isCaller = searchParams.get("from") === "ring";
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  /** Deschis din notificare push: WebRTC pornește doar după gest explicit (Răspunde). */
  const [callStarted, setCallStarted] = useState(() => !fromPush);
  const [resolvedAudioOnly, setResolvedAudioOnly] = useState(audioOnly);
  const [pushGateError, setPushGateError] = useState<string | null>(null);
  const [pushGateLoading, setPushGateLoading] = useState(false);
  const [incomingHint, setIncomingHint] = useState<{ fromName: string; audioOnly: boolean } | null>(null);
  const callSessionStartedRef = useRef(!fromPush);

  useEffect(() => {
    callSessionStartedRef.current = callStarted;
  }, [callStarted]);

  const fetchIncomingHint = useCallback(() => {
    if (!fromPush || callStarted) return;
    void fetchWithAuthRetry("/api/call/incoming", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return null;
        try {
          return await r.json();
        } catch {
          return null;
        }
      })
      .then((d) => {
        const inc = d && typeof d === "object" ? (d as { incoming?: { fromName?: string; audioOnly?: boolean; roomId?: string } }).incoming : null;
        if (inc?.roomId === roomId && inc.fromName) {
          setIncomingHint({ fromName: inc.fromName, audioOnly: Boolean(inc.audioOnly) });
        }
      })
      .catch(() => {});
  }, [fromPush, callStarted, roomId]);

  /**
   * Pe mobil (Safari, PWA, ITp) `align_user` lipsește des deși cookie-ul de sesiune e valid.
   * Fără /api/me, rămâneai la „Nu ai acces” sau înghețat — vezi și chat/[id] (meIdFromMeApi).
   */
  useEffect(() => {
    let cancelled = false;
    const local = getStoredUser();
    if (local?.id != null) {
      setUser(local);
      setAllowed(canAccessRoom(roomId, String(local.id)));
    } else {
      setUser(null);
      setAllowed(null);
    }

    void fetchWithAuthRetry("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          const d = (await r.json()) as { user?: User };
          const u = d.user;
          if (!u?.id) {
            if (!local) {
              setUser(null);
              setAllowed(false);
            }
            return;
          }
          setUser(u);
          try {
            if (typeof window !== "undefined") {
              const fromLocal = !!localStorage.getItem("align_user");
              (fromLocal ? localStorage : sessionStorage).setItem("align_user", JSON.stringify(u));
              window.dispatchEvent(new CustomEvent("align_user_updated", { detail: u }));
            }
          } catch {
            /* ignore */
          }
          setAllowed(canAccessRoom(roomId, String(u.id)));
          return;
        }
        if (r.status === 401 || r.status === 403) {
          setUser(null);
          setAllowed(false);
          return;
        }
        if (!local) {
          setUser(null);
          setAllowed(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!local) {
          setUser(null);
          setAllowed(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!fromPush || callStarted) return;
    fetchIncomingHint();
    const onFocus = () => fetchIncomingHint();
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") fetchIncomingHint();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fromPush, callStarted, fetchIncomingHint]);

  /**
   * Ieșire cu Back browser / navigare fără butonul din CallUI: tot trebuie să curățăm pending pe server,
   * altfel poll-ul „incoming” crede că încă sună. Întârziere scurtă evită dublarea în React Strict Mode (dev).
   * Din push, înainte de accept: respingem ca să primească apelantul feedback, nu `/end` de apel activ.
   */
  useEffect(() => {
    let armed = false;
    const tid = window.setTimeout(() => {
      armed = true;
    }, 450);
    return () => {
      window.clearTimeout(tid);
      if (!armed) return;
      markIncomingCallDismissed(roomId);
      if (!callSessionStartedRef.current) {
        void fetch("/api/call/reject", {
          method: "POST",
          headers: getAuthHeaders(),
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => {});
        return;
      }
      void fetch("/api/call/end", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ roomId }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [roomId]);

  /**
   * Închidere filă / browser: React cleanup poate să nu apuce să trimită fetch; sendBeacon/keepalive
   * ajunge mai des la server ca să nu rămână „te sună” la celălalt.
   * (Nu folosim visibilitychange — la schimbare tab s-ar încheia apelul greșit.)
   */
  useEffect(() => {
    const body = JSON.stringify({ roomId });
    const flush = () => {
      markIncomingCallDismissed(roomId);
      if (!callSessionStartedRef.current) {
        try {
          void fetch("/api/call/reject", {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "same-origin",
            keepalive: true,
          });
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon("/api/call/end", blob)) return;
        }
      } catch {
        /* fall through */
      }
      try {
        void fetch("/api/call/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body,
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };
    const onPageHide = (e: PageTransitionEvent) => {
      /** Pagina intră în bfcache (Back rapid) — nu încheiem apelul. */
      if (e.persisted) return;
      flush();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [roomId]);

  /** Încărcare: fullscreen negru ca la apel — fără „Se încarcă” în layout (evită clip cu mesajele de dedesubt). */
  if (allowed === null || user === null) {
    return (
      <div className="fixed inset-0 z-[190] flex flex-col items-center justify-center bg-black text-white">
        <div className="h-12 w-12 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin mb-4" aria-hidden />
        <span className="text-sm text-white/50">Se deschide apelul…</span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="fixed inset-0 z-[190] flex flex-col items-center justify-center bg-black px-4 text-center">
        <p className="text-white/70 mb-4">Nu ai acces la acest apel.</p>
        <Link href="/app/messages" className="text-brand-400 hover:underline">
          Înapoi la mesaje
        </Link>
      </div>
    );
  }

  const handlePushAnswer = () => {
    setPushGateError(null);
    setPushGateLoading(true);
    fetch("/api/call/accept", {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "same-origin",
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setPushGateError((d.error as string) || "Nu s-a putut răspunde. Apelul poate fi expirat.");
          return;
        }
        const accRoom = d.roomId as string | undefined;
        if (accRoom && accRoom !== roomId) {
          setPushGateError("Camera apelului nu se potrivește. Deschide din nou din notificare.");
          return;
        }
        if (typeof d.audioOnly === "boolean") {
          setResolvedAudioOnly(d.audioOnly);
        }
        markIncomingCallDismissed(typeof d.roomId === "string" ? d.roomId : roomId);
        setCallStarted(true);
      })
      .catch(() => setPushGateError("Eroare rețea. Încearcă din nou."))
      .finally(() => setPushGateLoading(false));
  };

  const handlePushDecline = () => {
    setPushGateLoading(true);
    markIncomingCallDismissed(roomId);
    fetch("/api/call/reject", {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "same-origin",
    })
      .finally(() => {
        setPushGateLoading(false);
        window.location.href = "/app/messages";
      });
  };

  if (fromPush && !callStarted) {
    const labelAudio = incomingHint?.audioOnly ?? audioOnly;
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black px-6 text-center text-white">
        <p className="text-white/50 text-sm mb-2">{labelAudio ? "Apel audio" : "Apel video"}</p>
        <p className="text-2xl font-semibold mb-2">
          {incomingHint?.fromName ? incomingHint.fromName : "Apel primit"}
        </p>
        <p className="text-white/60 text-sm mb-8 max-w-sm">
          Din browser, apelul pornește doar după ce alegi să răspunzi — vei fi întrebat de microfon/cameră la pasul următor.
        </p>
        {pushGateError ? (
          <p className="text-amber-400 text-sm mb-6 max-w-sm" role="alert">
            {pushGateError}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <button
            type="button"
            onClick={handlePushDecline}
            disabled={pushGateLoading}
            className="flex-1 rounded-xl border border-white/20 py-4 text-white/80 hover:bg-white/10 transition disabled:opacity-50"
          >
            Respinge
          </button>
          <button
            type="button"
            onClick={handlePushAnswer}
            disabled={pushGateLoading}
            className="flex-1 rounded-xl bg-green-500/90 text-white font-semibold py-4 hover:bg-green-500 transition disabled:opacity-50"
          >
            {pushGateLoading ? "Se deschide…" : "Atinge pentru a răspunde"}
          </button>
        </div>
        <Link href="/app/messages" className="mt-10 text-sm text-white/40 hover:text-brand-400 underline">
          Înapoi la mesaje
        </Link>
      </div>
    );
  }

  return (
    <CallUI
      roomId={roomId}
      userId={String(user.id)}
      displayName={displayName((user.username ?? user.name) || "Utilizator")}
      audioOnly={resolvedAudioOnly}
      isConference={isConferenceRoomId(roomId)}
      isCaller={fromPush ? false : isCaller}
    />
  );
}
