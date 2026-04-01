"use client";

import { useEffect, useState } from "react";
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
  const isCaller = searchParams.get("from") === "ring";
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

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

  /**
   * Ieșire cu Back browser / navigare fără butonul din CallUI: tot trebuie să curățăm pending pe server,
   * altfel poll-ul „incoming” crede că încă sună. Întârziere scurtă evită dublarea în React Strict Mode (dev).
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

  return (
    <CallUI
      roomId={roomId}
      userId={String(user.id)}
      displayName={displayName((user.username ?? user.name) || "Utilizator")}
      audioOnly={audioOnly}
      isConference={isConferenceRoomId(roomId)}
      isCaller={isCaller}
    />
  );
}
