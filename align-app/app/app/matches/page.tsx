"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Video, Phone, MessageCircle } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";

type MatchWithMeta = User & { online?: boolean; distanceKm?: number; distanceHidden?: boolean };

function formatDistance(km: number | undefined): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

export default function MatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);

  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw ? (() => { try { return JSON.parse(meRaw); } catch { return null; } })() : null;

  const startCall = async (toId: string, audioOnly: boolean) => {
    if (!me?.id || callingId) return;
    setCallingId(toId);
    try {
      await fetch("/api/call/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ toId, audioOnly }),
      });
    } finally {
      setCallingId(null);
    }
    router.push(`/app/call/${getVideoRoomId(me.id, toId)}${audioOnly ? "?audio=1&from=ring" : "?from=ring"}`);
  };

  useEffect(() => {
    (async () => {
      const matchRes = await fetch("/api/matches", { headers: getAuthHeaders() });
      if (matchRes.ok) {
        const data = await matchRes.json();
        setMatches(data.matches || []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă...</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Matches</h2>
      {matches.length === 0 ? (
        <p className="text-dark-500">
          Încă nu ai matches. Like-uiește profiluri din Descoperă; când și ei te
          vor like, apăreți aici.
        </p>
      ) : (
        <ul className="space-y-4">
          {matches.map((u) => (
            <li
              key={u.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-500/20 flex items-center justify-center shrink-0">
                <SilhouetteAvatar
                  photoUrl={u.photos?.[0]}
                  gender={u.gender}
                  name={u.name}
                  className="w-full h-full text-brand-400"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{displayName(u.username ?? u.name)}</p>
                <p className="text-sm text-dark-500 line-clamp-1">{u.bio || "—"}</p>
                <p className="text-xs text-dark-400 mt-1">
                  {u.distanceHidden || u.distanceKm == null
                    ? "Distanță ascunsă"
                    : u.distanceKm < 1
                      ? "În apropiere"
                      : formatDistance(u.distanceKm)}
                  <span className="mx-2">·</span>
                  <span className={u.online ? "text-green-400" : "text-dark-500"}>
                    {u.online ? "Online" : "Offline"}
                  </span>
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startCall(u.id, false)}
                  disabled={!!callingId}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 active:bg-brand-500/40 transition disabled:opacity-50 touch-manipulation"
                  title="Apel video"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => startCall(u.id, true)}
                  disabled={!!callingId}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-dark-600 text-white hover:bg-dark-500 active:bg-dark-400 transition disabled:opacity-50 touch-manipulation"
                  title="Apel audio"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <Link
                  href={`/app/chat/${u.id}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-400 hover:bg-brand-500/20 active:bg-brand-500/30 transition touch-manipulation"
                  title="Mesaj"
                >
                  <MessageCircle className="w-5 h-5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
