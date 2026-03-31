"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, History } from "lucide-react";
import type { User } from "@/lib/store";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";

type MatchWithMeta = User & { online?: boolean; distanceKm?: number; distanceHidden?: boolean };

function formatDistance(km: number | undefined): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
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
          {matches.map((u) => {
            const matchLabel = displayName(u.username ?? u.name);
            return (
            <li
              key={u.id}
              className="flex items-stretch rounded-xl bg-dark-800 border border-dark-600 hover:border-dark-500 overflow-hidden touch-manipulation"
            >
              <Link
                href={`/app/user/${u.id}`}
                className="flex flex-1 min-w-0 items-center gap-4 p-4 min-h-[56px] hover:bg-dark-700/50 active:bg-dark-700/70 transition"
                aria-label={`Vezi profilul: ${matchLabel}`}
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
                  <p className="font-medium text-zinc-900">{matchLabel}</p>
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
              </Link>
              <div className="shrink-0 flex items-center gap-2 pr-3 pl-2 border-l border-dark-600 bg-dark-800">
                <QuickCallButtons toUserId={u.id} size="md" />
                <Link
                  href={`/app/review-swipes?focus=${encodeURIComponent(u.id)}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-amber-400/90 hover:bg-amber-500/15 active:bg-amber-500/25 transition touch-manipulation"
                  title="Recenzează swipe (like/pass) — se salvează doar dacă alegi din nou"
                >
                  <History className="w-5 h-5" />
                </Link>
                <Link
                  href={`/app/chat/${u.id}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-400 hover:bg-brand-500/20 active:bg-brand-500/30 transition touch-manipulation"
                  title="Mesaj"
                >
                  <MessageCircle className="w-5 h-5" />
                </Link>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
