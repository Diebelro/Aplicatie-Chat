"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Phone, PhoneOff } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";

const POLL_MS = 1000;

interface IncomingCallData {
  fromId: string;
  fromName: string;
  roomId: string;
  audioOnly: boolean;
}

/** Sunet de apel (două tonuri, ca la telefon). */
function useRingtone(active: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;

    const playTone = (freq: number, duration: number) => {
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.15;
      osc.start(ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    };

    const ring = () => {
      playTone(440, 0.4);
      setTimeout(() => playTone(480, 0.4), 400);
    };

    ring();
    intervalRef.current = setInterval(ring, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      ctx.close();
      ctxRef.current = null;
    };
  }, [active]);
}

export default function IncomingCall() {
  const router = useRouter();
  const pathname = usePathname();
  /** Pe pagina de apel nu mai arătăm overlay / sunet — evită „sună continuu” după Răspunde. */
  const onCallPage = pathname?.startsWith("/app/call") ?? false;

  const [incoming, setIncoming] = useState<IncomingCallData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useRingtone(!!incoming && !onCallPage);

  const fetchIncoming = useCallback(() => {
    fetch("/api/call/incoming", {
      headers: getAuthHeaders(),
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.incoming) setIncoming(d.incoming);
        else setIncoming(null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (onCallPage) {
      setIncoming(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    fetchIncoming();
    pollRef.current = setInterval(fetchIncoming, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchIncoming, onCallPage]);

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
          setIncoming(null);
          const q = d.audioOnly ? "?audio=1" : "";
          router.push(`/app/call/${d.roomId}${q}`);
        } else {
          setActionError("Nu s-a putut deschide apelul. Reîncearcă.");
        }
      })
      .catch(() => setActionError("Eroare rețea. Verifică conexiunea."))
      .finally(() => setLoading(false));
  };

  const handleDecline = () => {
    if (!incoming || loading) return;
    setActionError(null);
    setLoading(true);
    fetch("/api/call/reject", {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "same-origin",
    })
      .finally(() => {
        setLoading(false);
        setIncoming(null);
      });
  };

  if (onCallPage || !incoming) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-900 min-h-screen p-6">
      <p className="text-dark-400 text-base mb-2">
        {incoming.audioOnly ? "Apel audio" : "Apel video"}
      </p>
      <p className="text-2xl md:text-3xl font-semibold text-white mb-2 text-center">
        {incoming.fromName}
      </p>
      <p className="text-lg text-dark-400 mb-8">te sună</p>
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
    </div>
  );
}
