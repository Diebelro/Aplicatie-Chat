"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
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

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    if (!u) {
      setAllowed(false);
      return;
    }
    setAllowed(canAccessRoom(roomId, u.id));
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
      userId={user.id}
      displayName={displayName((user.username ?? user.name) || "Utilizator")}
      audioOnly={audioOnly}
      isConference={isConferenceRoomId(roomId)}
      isCaller={isCaller}
    />
  );
}
