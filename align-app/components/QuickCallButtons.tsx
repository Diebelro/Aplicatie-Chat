"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Phone } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { getVideoRoomId } from "@/lib/videoCall";
import type { RingNotifySnapshot } from "@/lib/callRingNotifySnapshot";
import { RING_PUSH_HINT_DELAY_MS, formatRingNotifyHint } from "@/lib/callRingNotifySnapshot";

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
  /** sm = listă Mesaje; md = carduri; discover = butoane rotunde pe card Descoperă */
  size?: "sm" | "md" | "discover";
  className?: string;
};

/**
 * Video + Audio 1-la-1: ring + redirect la /app/call/[room].
 * Folosit în Mesaje, liste; nu propaga click către Link părinte.
 */
export function QuickCallButtons({ toUserId, size = "md", className = "" }: QuickCallButtonsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [callHint, setCallHint] = useState<string | null>(null);

  const start = async (audioOnly: boolean) => {
    if (busy || !toUserId) return;
    setCallHint(null);
    const myId = await resolveMyIdForCall();
    if (!myId) {
      setCallHint("Nu s-a încărcat sesiunea. Reîncarcă pagina sau intră din nou în cont, apoi încearcă apelul.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetchWithAuthRetry("/api/call/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: toUserId, audioOnly }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = typeof j.error === "string" && j.error.trim() ? j.error.trim() : "Nu am putut porni apelul.";
        setCallHint(msg);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { notify?: RingNotifySnapshot };
      const pushHint = formatRingNotifyHint(j.notify);
      if (pushHint) {
        setCallHint(pushHint);
        await new Promise((r) => setTimeout(r, RING_PUSH_HINT_DELAY_MS));
      }
      router.push(`/app/call/${getVideoRoomId(myId, toUserId)}${audioOnly ? "?audio=1&from=ring" : "?from=ring"}`);
    } catch {
      setCallHint("Eroare rețea. Verifică conexiunea.");
    } finally {
      setBusy(false);
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
    return (
      <div className={`flex flex-col items-end gap-1 shrink-0 ${className}`}>
        <div
          className="flex items-center gap-2 sm:gap-3"
          onClick={stopEvt}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="Apel video sau audio"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void start(false)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-dark-600 hover:bg-brand-500/20 active:scale-90 flex items-center justify-center text-brand-400 border-2 border-brand-500/40 transition-[transform,background-color] duration-75 touch-none shrink-0 disabled:opacity-50"
            title="Apel video"
          >
            <Video className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start(true)}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-sky-500/15 hover:bg-sky-500/25 active:scale-90 flex items-center justify-center text-sky-600 border-2 border-sky-500/40 transition-[transform,background-color] duration-75 touch-none shrink-0 disabled:opacity-50"
            title="Apel audio"
          >
            <Phone className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>
        {hintEl}
      </div>
    );
  }

  const wrap = size === "sm" ? "gap-0.5" : "gap-1";
  const btn =
    size === "sm"
      ? "w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg"
      : "min-h-[44px] min-w-[44px] rounded-lg";
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
        aria-label="Apel video sau audio"
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => void start(false)}
          className={`flex items-center justify-center ${btn} bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 border border-brand-500/35 transition touch-manipulation disabled:opacity-50`}
          title="Apel video"
        >
          <Video className={icon} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void start(true)}
          className={`flex items-center justify-center ${btn} bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 border border-sky-500/40 transition touch-manipulation disabled:opacity-50`}
          title="Apel audio"
        >
          <Phone className={icon} />
        </button>
      </div>
      {hintEl}
    </div>
  );
}
