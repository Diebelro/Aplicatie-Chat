"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MessageCircle, Vote } from "lucide-react";
import type { User } from "@/lib/store";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { displayName } from "@/lib/displayName";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useVisibleInterval } from "@/lib/useVisibleInterval";
import { getPresencePollMs } from "@/lib/presencePollMs";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { SkeletonConversationList } from "@/components/perceived/AppShellLoadingLayout";

type MatchWithMeta = User & { online?: boolean; distanceKm?: number; distanceHidden?: boolean };

const MATCHES_CACHE_KEY = "align_matches_list_v1";

function readMatchesCache(): MatchWithMeta[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(MATCHES_CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MatchWithMeta[];
    return Array.isArray(arr) ? sortMatchesForDisplay(arr) : [];
  } catch {
    return [];
  }
}

function formatDistance(km: number | undefined): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

/** Online primii; apoi activitate recentă; același id = ordine stabilă. */
function sortMatchesForDisplay(list: MatchWithMeta[]): MatchWithMeta[] {
  return [...list].sort((a, b) => {
    const ao = a.online ? 1 : 0;
    const bo = b.online ? 1 : 0;
    if (bo !== ao) return bo - ao;
    const ta = a.last_active ?? 0;
    const tb = b.last_active ?? 0;
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });
}

export default function MatchesPage() {
  const { tStr } = useI18n();
  const [matches, setMatches] = useState<MatchWithMeta[]>(() => readMatchesCache());
  const [inFlight, setInFlight] = useState(() => readMatchesCache().length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const matchesRef = useRef<MatchWithMeta[]>([]);
  matchesRef.current = matches;

  const fetchMatches = useCallback(
    async (silent: boolean) => {
      if (!silent && matchesRef.current.length === 0) setInFlight(true);
      setLoadError(null);
      try {
        const matchRes = await fetchWithAuthRetry("/api/matches", { cache: "no-store" });
        if (!mountedRef.current) return;
        if (!matchRes.ok) {
          if (silent) return;
          setLoadError(tStr("pages.matches.loadError"));
          setMatches([]);
          return;
        }
        const data = await matchRes.json();
        const raw = (data.matches || []) as MatchWithMeta[];
        const sorted = sortMatchesForDisplay(raw);
        setMatches(sorted);
        try {
          sessionStorage.setItem(MATCHES_CACHE_KEY, JSON.stringify(sorted));
        } catch {
          /* ignore */
        }
      } catch {
        if (!mountedRef.current) return;
        if (silent) return;
        setLoadError(tStr("pages.matches.loadError"));
        setMatches([]);
      } finally {
        if (mountedRef.current) setInFlight(false);
      }
    },
    [tStr]
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchMatches(matchesRef.current.length > 0);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchMatches]);

  useVisibleInterval(
    () => void fetchMatches(true),
    getPresencePollMs(),
    !inFlight
  );

  const showListOverlay = inFlight && matches.length === 0;

  return (
    <div>
      <h2 className="app-pro-page-title mb-6">{tStr("pages.matches.title")}</h2>

      <div className="relative min-h-[min(280px,45vh)]">
        {showListOverlay && (
          <div
            className="absolute inset-0 z-20 flex flex-col justify-center gap-3 rounded-xl bg-dark-900/90 border border-dark-600/50 px-2 py-4 overflow-hidden motion-reduce:transition-none"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <SkeletonConversationList rows={5} />
            <span className="text-xs text-dark-400 px-4 text-center shrink-0">{tStr("pages.matches.loadingList")}</span>
          </div>
        )}

        {loadError && matches.length === 0 ? (
          <div className="app-pro-empty flex flex-col items-center gap-4 py-10">
            <p className="app-pro-lead text-center max-w-md">{loadError}</p>
            <button
              type="button"
              onClick={() => void fetchMatches(false)}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              {tStr("common.shellErrors.tryAgain")}
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="app-pro-empty">
            <p className="app-pro-lead">{tStr("pages.matches.empty")}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {matches.map((u) => {
              const matchLabel = displayName(u.username ?? u.name);
              return (
                <li
                  key={u.id}
                  className="flex items-stretch rounded-xl bg-dark-800 border border-dark-600 shadow-sm hover:border-dark-500 overflow-hidden touch-manipulation"
                >
                  <Link
                    href={`/app/user/${u.id}`}
                    className="flex flex-1 min-w-0 items-center gap-4 p-4 min-h-[56px] hover:bg-dark-700/50 active:bg-dark-700/70 transition"
                    aria-label={formatTpl(tStr("pages.matches.viewProfileAria"), { name: matchLabel })}
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
                          ? tStr("pages.matches.distanceHidden")
                          : u.distanceKm < 1
                            ? tStr("pages.matches.nearby")
                            : formatDistance(u.distanceKm)}
                        <span className="mx-2">·</span>
                        <span className={u.online ? "text-green-400" : "text-dark-500"}>
                          {u.online ? tStr("pages.matches.online") : tStr("pages.matches.offline")}
                        </span>
                      </p>
                    </div>
                  </Link>
                  <div className="shrink-0 flex items-center gap-2 px-3 border-l border-dark-600 bg-dark-800">
                    <QuickCallButtons toUserId={u.id} size="md" />
                    <Link
                      href={`/app/review-swipes?focus=${encodeURIComponent(u.id)}`}
                      className="min-h-[44px] min-w-[3rem] sm:min-w-[5.25rem] shrink-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 px-1.5 sm:px-2 rounded-lg text-amber-400/90 hover:bg-amber-500/15 active:bg-amber-500/25 transition touch-manipulation"
                      title={tStr("pages.matches.swipeDecisionTitle")}
                      aria-label={formatTpl(tStr("pages.matches.swipeDecisionAria"), { name: matchLabel })}
                    >
                      <Vote className="w-5 h-5 shrink-0" aria-hidden />
                      <span className="text-[9px] sm:text-[11px] font-medium text-amber-200/95 leading-tight text-center max-w-[3.25rem] sm:max-w-[4.5rem] line-clamp-2">
                        {tStr("pages.matches.swipeDecisionShort")}
                      </span>
                    </Link>
                    <Link
                      href={`/app/chat/${u.id}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-brand-400 hover:bg-brand-500/20 active:bg-brand-500/30 transition touch-manipulation"
                      title={tStr("pages.matches.messageTitle")}
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
    </div>
  );
}
