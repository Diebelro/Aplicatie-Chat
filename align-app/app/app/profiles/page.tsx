"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Trash2, MessageCircle, Users, Clock, UserPlus, Eye, MessageSquare, CheckCheck, Heart, ShieldOff, Flag, Circle, Sparkles, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import {
  useSearchFilters,
  hasActiveSearchFilters,
  broadenSearchFilters,
} from "@/lib/useSearchFilters";
import { useVisibleInterval } from "@/lib/useVisibleInterval";
import { getPresencePollMs } from "@/lib/presencePollMs";
import { DiebelAppPromoCarousel } from "@/components/diebel/DiebelAppPromoCarousel";
import AdSlot from "@/components/AdSlot";
import { SharedSearchFiltersPanel } from "@/components/SharedSearchFiltersPanel";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { ProfilePhotoCountBars } from "@/components/ProfilePhotoCountBars";
import { getFirstUsableProfilePhotoUrl, getUsableProfilePhotoUrls } from "@/lib/profileImage";
import { AddFriendButton } from "@/components/AddFriendButton";
import { getSmallCardState, FRIEND_CARD_COLORS } from "@/lib/friendCardStates";
import { displayName } from "@/lib/displayName";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { buildDiscoverApiQuery } from "@/lib/discoverSearchParams";
import { passesSharedSearchFilters } from "@/lib/applySearchFiltersLocal";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { AppProLoading } from "@/components/AppProLoading";
import {
  clearListScroll,
  hasListPlace,
  listItemDomId,
  restoreListScroll,
  saveListPlace,
  saveListScroll,
  saveProfileReturnPath,
} from "@/lib/listScrollSession";

/** Culori pentru cele 3 stări pe profil – fără suprapuneri, un singur state per card. */
const PROFILE_STATE_COLORS = {
  online: FRIEND_CARD_COLORS.online,      // #51CF66
  isNew: FRIEND_CARD_COLORS.isNew,        // #339AF0
  notVisited: FRIEND_CARD_COLORS.notVisited, // #868E96
} as const;

const LEGEND_KEYS = [
  "friends",
  "pendingSent",
  "pendingReceived",
  "match",
  "messageSeen",
  "messageReceived",
  "visitedYou",
  "visitedByYou",
  "online",
  "isNew",
  "notVisited",
] as const;

type FriendStatusApi = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

type ProfileWithOnline = User & {
  online?: boolean;
  isNew?: boolean;
  distanceKm?: number;
  distanceHidden?: boolean;
  visited?: boolean;
  visitedByThem?: boolean;
  sentMessage?: boolean;
  receivedMessage?: boolean;
  messageSeen?: boolean;
  friendStatus?: FriendStatusApi;
  match?: boolean;
};

const PROFILES_CACHE_KEY = "align_profiles_list_v3";
const PROFILES_CACHE_QUERY_KEY = "align_profiles_list_query_v3";
const SCROLL_KEY = "profiles";

function readProfilesCache(): { query: string; profiles: ProfileWithOnline[] } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const query = sessionStorage.getItem(PROFILES_CACHE_QUERY_KEY) ?? "";
    const raw = sessionStorage.getItem(PROFILES_CACHE_KEY);
    if (!raw) return null;
    const profiles = JSON.parse(raw) as ProfileWithOnline[];
    if (!Array.isArray(profiles) || profiles.length === 0) return null;
    return { query, profiles };
  } catch {
    return null;
  }
}

function writeProfilesCache(query: string, profiles: ProfileWithOnline[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PROFILES_CACHE_QUERY_KEY, query);
    sessionStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(profiles));
  } catch {
    /* ignore quota */
  }
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  friends: Users,
  pendingSent: Clock,
  pendingReceived: UserPlus,
  visitedByYou: Eye,
  visitedYou: Eye,
  messageReceived: MessageSquare,
  messageSeen: CheckCheck,
  match: Heart,
  online: Circle,
  isNew: Sparkles,
  notVisited: EyeOff,
  none: () => null,
};

function formatDistance(km: number | undefined): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

export default function ProfilesPage() {
  const { tStr, locale } = useI18n();
  const getDistanceDisplay = useCallback(
    (u: ProfileWithOnline): string => {
      if (u.distanceHidden || u.distanceKm == null) return tStr("pages.matches.distanceHidden");
      const isFriend = u.friendStatus === "accepted";
      if (isFriend && u.distanceKm < 1) return tStr("pages.matches.nearby");
      return formatDistance(u.distanceKm);
    },
    [tStr]
  );
  const searchParams = useSearchParams();
  const previewMe = searchParams?.get("preview") === "me";
  const [profiles, setProfiles] = useState<ProfileWithOnline[]>(() => {
    if (typeof window === "undefined") return [];
    if (!hasListPlace(SCROLL_KEY)) return [];
    return readProfilesCache()?.profiles ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return !(hasListPlace(SCROLL_KEY) && (readProfilesCache()?.profiles.length ?? 0) > 0);
  });
  const restorePendingRef = useRef(typeof window !== "undefined" && hasListPlace(SCROLL_KEY));
  const [filters, setFilters, filtersReady] = useSearchFilters(locale);
  const filtersActive = hasActiveSearchFilters(filters);
  const filtersKeyRef = useRef("");
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const profilesSeqRef = useRef(0);
  const profilesAbortRef = useRef<AbortController | null>(null);

  // Păstrează sortarea aleasă: e preferință de afișare, nu criteriu de căutare.
  const resetFilters = useCallback(() => {
    restorePendingRef.current = false;
    clearListScroll(SCROLL_KEY);
    setFilters((f) => broadenSearchFilters(f));
  }, [setFilters]);

  const onFilterPending = useCallback(() => {
    restorePendingRef.current = false;
    clearListScroll(SCROLL_KEY);
    profilesAbortRef.current?.abort();
    profilesSeqRef.current += 1;
    setProfiles((prev) => prev.filter((u) => passesSharedSearchFilters(u, filters)));
    setLoading(true);
  }, [filters]);

  const rememberPlaceBeforeProfile = useCallback((userId: string) => {
    saveListPlace(SCROLL_KEY, userId);
    saveProfileReturnPath("/app/profiles");
    const q = filtersKeyRef.current || buildDiscoverApiQuery(filters);
    if (profilesRef.current.length > 0) writeProfilesCache(q, profilesRef.current);
  }, [filters]);

  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw ? (() => { try { return JSON.parse(meRaw); } catch { return null; } })() : null;

  useEffect(() => {
    if (!filtersReady) return;
    profilesAbortRef.current?.abort();
    const ac = new AbortController();
    profilesAbortRef.current = ac;
    const seq = ++profilesSeqRef.current;
    const key = buildDiscoverApiQuery(filters);
    filtersKeyRef.current = key;

    const cache = readProfilesCache();
    const cacheMatches = cache != null && cache.query === key && cache.profiles.length > 0;

    if (cacheMatches) {
      setProfiles(cache.profiles);
      setLoading(false);
    } else {
      setProfiles((prev) => prev.filter((u) => passesSharedSearchFilters(u, filters)));
      setLoading(true);
    }

    fetchWithAuthRetry(`/api/profiles${key}`, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return { profiles: [] as ProfileWithOnline[] };
        return { profiles: (data.profiles ?? []) as ProfileWithOnline[] };
      })
      .then(({ profiles: list }) => {
        if (seq !== profilesSeqRef.current) return;
        setProfiles(list);
        writeProfilesCache(key, list);
        setLoading(false);
        if (restorePendingRef.current) {
          restoreListScroll(SCROLL_KEY);
          window.setTimeout(() => {
            restorePendingRef.current = false;
          }, 800);
        }
      })
      .catch((err: unknown) => {
        if (seq !== profilesSeqRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoading(false);
      });
    return () => {
      ac.abort();
      saveListScroll(SCROLL_KEY);
    };
  }, [filtersReady, filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy]);

  // Cache + loc înainte de paint, doar dacă revenim din profil și query-ul e același.
  useLayoutEffect(() => {
    if (!filtersReady) return;
    const key = buildDiscoverApiQuery(filters);
    const cache = readProfilesCache();
    if (cache?.profiles.length && cache.query === key && profilesRef.current.length === 0) {
      setProfiles(cache.profiles);
      setLoading(false);
    }
    if (restorePendingRef.current) restoreListScroll(SCROLL_KEY);
  }, [filtersReady]);

  useLayoutEffect(() => {
    if (!restorePendingRef.current || profiles.length === 0) return;
    restoreListScroll(SCROLL_KEY);
  }, [profiles.length, loading]);

  const refreshProfilesList = useCallback(() => {
    if (!filtersReady) return;
    const key = buildDiscoverApiQuery(filters);
    void fetchWithAuthRetry(`/api/profiles${key}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (key !== filtersKeyRef.current) return;
        if (d.profiles) {
          setProfiles(d.profiles);
          writeProfilesCache(key, d.profiles);
        }
      })
      .catch(() => {});
  }, [filters, filtersReady]);

  useVisibleInterval(refreshProfilesList, getPresencePollMs(), profiles.length > 0);

  useEffect(() => {
    const onConversationRead = () => {
      const key = buildDiscoverApiQuery(filters);
      fetchWithAuthRetry(`/api/profiles${key}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((d) => {
          if (key !== filtersKeyRef.current) return;
          if (d.profiles) {
            setProfiles(d.profiles);
            writeProfilesCache(key, d.profiles);
          }
        });
    };
    window.addEventListener("align:conversation-read", onConversationRead);
    return () => window.removeEventListener("align:conversation-read", onConversationRead);
  }, [filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy]);

  const handleDelete = async (userId: string) => {
    await fetchWithAuthRetry("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toId: userId, liked: false }),
      cache: "no-store",
    });
    setProfiles((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleBlock = async (userId: string) => {
    if (!confirm(tStr("pages.profiles.blockConfirm"))) return;
    const res = await fetchWithAuthRetry("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });
    if (res.ok) setProfiles((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleReport = async (userId: string) => {
    const reason = window.prompt(tStr("pages.profiles.reportPrompt"));
    if (reason === null) return;
    await fetchWithAuthRetry("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: userId,
        reason: reason || tStr("pages.profiles.reportReasonDefault"),
      }),
    });
  };

  return (
    <div>
      <h2 className="app-pro-page-title mb-4">{tStr("pages.profiles.title")}</h2>

      {filtersReady ? (
      <SharedSearchFiltersPanel
        filters={filters}
        onApply={setFilters}
        locale={locale}
        tStr={tStr}
        showSortBy
        onReset={resetFilters}
        onFilterPending={onFilterPending}
      />
      ) : null}

      <DiebelAppPromoCarousel />
      <AdSlot variant="strip" />
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-dark-500">
        {LEGEND_KEYS.map((key) => {
          const color = FRIEND_CARD_COLORS[key as keyof typeof FRIEND_CARD_COLORS];
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border shrink-0" style={{ borderColor: `${color}80`, backgroundColor: `${color}1A` }} />
              {tStr(`pages.discover.legend.${key}`)}
            </span>
          );
        })}
        <span>{tStr("pages.discover.distanceNote")}</span>
      </div>

      {loading && profiles.length === 0 ? (
        <AppProLoading variant="profiles" label={tStr("pages.profiles.loading")} className="py-16" />
      ) : profiles.length === 0 ? (
        <div className="app-pro-empty">
          <p className="app-pro-lead">{tStr("pages.profiles.empty")}</p>
          {filtersActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 h-11 rounded-lg border border-dark-600 bg-dark-700 px-4 text-sm text-dark-400 hover:bg-dark-600 hover:text-brand-400 transition touch-manipulation"
            >
              {tStr("pages.discover.showAllUsers")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
      {previewMe && me && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">{tStr("pages.profiles.previewTitle")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-md">
            <div className="border rounded-2xl overflow-hidden flex flex-col bg-dark-800 border-dark-600">
              <div className="relative w-full aspect-[4/5] bg-dark-700 overflow-hidden">
                <SilhouetteAvatar
                  photoUrl={getFirstUsableProfilePhotoUrl(me.photos)}
                  gender={me.gender}
                  name={me.name}
                  shape="rectangle"
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover object-[center_18%]"
                />
                <ProfilePhotoCountBars
                  count={getUsableProfilePhotoUrls(me.photos).length}
                  compact
                />
              </div>
              <div className="flex-1 min-w-0 p-4">
                <p className="font-semibold text-zinc-900 truncate">{displayName(me.username ?? me.name)}</p>
                <p className="text-xs mt-0.5 text-brand-400">{tStr("pages.profiles.youLabel")}</p>
                {me.bio?.trim() && (
                  <p className="text-sm text-dark-500 mt-1 line-clamp-2">{me.bio.trim()}</p>
                )}
                <p className="text-xs text-dark-400 mt-1 flex flex-wrap gap-x-2 gap-y-0">
                  {me.age != null && (
                    <span>{formatTpl(tStr("pages.profiles.ageYears"), { n: me.age })}</span>
                  )}
                  {me.gender && (
                    <span>
                      {me.gender === "male"
                        ? tStr("pages.discover.genderMale")
                        : me.gender === "female"
                          ? tStr("pages.discover.genderFemale")
                          : tStr("pages.discover.genderOther")}
                    </span>
                  )}
                  {me.height != null && <span>{me.height} cm</span>}
                  {me.eyeColor && (
                    <span>{formatTpl(tStr("pages.discover.eyePrefix"), { v: me.eyeColor })}</span>
                  )}
                  {me.hairColor && (
                    <span>{formatTpl(tStr("pages.discover.hairPrefix"), { v: me.hairColor })}</span>
                  )}
                  {me.city && <span>{me.city}</span>}
                  <span>—</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {profiles.map((u) => {
          const { border, statusKey } = getSmallCardState({
            friendStatus: u.friendStatus ?? null,
            match: u.match,
            messageSeen: u.messageSeen,
            receivedMessage: u.receivedMessage,
            visitedByThem: u.visitedByThem,
            visited: u.visited,
            online: u.online,
            isNew: u.isNew,
          });
          const stateColor = (statusKey === "online" || statusKey === "isNew" || statusKey === "notVisited")
            ? PROFILE_STATE_COLORS[statusKey]
            : border;
          const borderStyle = border ? { borderColor: border, borderWidth: 2, backgroundColor: `${border}12` } : {};
          const IconComp = STATUS_ICONS[statusKey];
          const statusLabel =
            statusKey !== "none" ? tStr(`pages.discover.legend.${statusKey}`) : "";
          return (
          <div
            key={u.id}
            id={listItemDomId(SCROLL_KEY, u.id)}
            data-list-item={u.id}
            className={`rounded-2xl overflow-hidden card-hover flex flex-col ${!border ? "bg-dark-800 border border-dark-600" : "border"}`}
            style={borderStyle}
          >
            <Link
              href={`/app/user/${u.id}`}
              scroll={false}
              onClick={() => rememberPlaceBeforeProfile(u.id)}
              className="block flex-1 min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900 rounded-t-2xl group"
              aria-label={formatTpl(tStr("pages.profiles.viewProfileAria"), {
                name: displayName(u.username ?? u.name),
              })}
            >
              <div
                className={`relative w-full aspect-[4/5] bg-dark-700 overflow-hidden transition-[filter] group-hover:brightness-110 ${
                  statusKey === "notVisited" ? "brightness-[0.9] saturate-[0.95]" : ""
                }`}
              >
                <SilhouetteAvatar
                  photoUrl={getFirstUsableProfilePhotoUrl(u.photos)}
                  gender={u.gender}
                  name={u.name}
                  shape="rectangle"
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover object-[center_18%]"
                />
                <ProfilePhotoCountBars
                  count={getUsableProfilePhotoUrls(u.photos).length}
                  compact
                />
              </div>
              <div className="flex-1 min-w-0 px-3 pt-2.5 pb-2">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <p className="font-semibold text-zinc-900 truncate group-hover:text-brand-600 transition-colors leading-tight">
                    {displayName(u.username ?? u.name)}
                  </p>
                  {u.online ? (
                    <span
                      className="shrink-0 inline-block w-2 h-2 rounded-full mt-1.5"
                      style={{ backgroundColor: PROFILE_STATE_COLORS.online }}
                      title={tStr("pages.messages.online")}
                      aria-label={tStr("pages.messages.online")}
                    />
                  ) : null}
                </div>
                {statusLabel && (
                  <p className="text-[11px] mt-0.5 flex items-center gap-1 font-medium truncate" style={{ color: stateColor || border || undefined }}>
                    {IconComp && (
                      <span className="shrink-0" style={{ color: stateColor || border || undefined }}>
                        <IconComp className="w-3 h-3" />
                      </span>
                    )}
                    {statusLabel}
                  </p>
                )}
                <p className="text-[11px] text-dark-400 mt-1 flex flex-wrap gap-x-1.5 gap-y-0 leading-snug">
                  {u.age != null && (
                    <span>{formatTpl(tStr("pages.profiles.ageYears"), { n: u.age })}</span>
                  )}
                  {u.gender && (
                    <span>
                      {u.gender === "male"
                        ? tStr("pages.discover.genderMale")
                        : u.gender === "female"
                          ? tStr("pages.discover.genderFemale")
                          : tStr("pages.discover.genderOther")}
                    </span>
                  )}
                  {u.city && <span>{u.city}</span>}
                  <span title={tStr("pages.profiles.distanceTitle")}>{getDistanceDisplay(u)}</span>
                </p>
              </div>
            </Link>
            <div className="px-2.5 pb-2.5 pt-2 border-t border-dark-600/80 flex flex-col gap-1.5">
              <AddFriendButton
                userId={u.id}
                friendStatus={u.friendStatus ?? null}
                onStatusChange={() => {
                  fetchWithAuthRetry(`/api/profiles${buildDiscoverApiQuery(filters)}`, { cache: "no-store" })
                    .then(async (res) => res.ok && (await res.json()).profiles)
                    .then((list) => list && setProfiles(list));
                }}
                variant="small"
                className="w-full justify-center"
              />
              <div className="grid grid-cols-6 gap-1">
                <QuickCallButtons toUserId={u.id} size="toolbar" />
                <Link
                  href={`/app/chat/${u.id}`}
                  className="flex h-9 w-full items-center justify-center rounded-lg text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 transition touch-manipulation"
                  title={tStr("pages.profiles.sendMessageTitle")}
                  aria-label={tStr("pages.profiles.sendMessageTitle")}
                >
                  <MessageCircle className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleBlock(u.id)}
                  className="flex h-9 w-full items-center justify-center rounded-lg text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition touch-manipulation"
                  title={tStr("pages.profiles.blockUserTitle")}
                  aria-label={tStr("pages.profiles.blockUserTitle")}
                >
                  <ShieldOff className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReport(u.id)}
                  className="flex h-9 w-full items-center justify-center rounded-lg text-dark-400 bg-dark-700/80 hover:bg-dark-600 border border-dark-600 transition touch-manipulation"
                  title={tStr("pages.profiles.reportTitle")}
                  aria-label={tStr("pages.profiles.reportTitle")}
                >
                  <Flag className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(u.id)}
                  className="flex h-9 w-full items-center justify-center rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 transition touch-manipulation"
                  title={tStr("pages.profiles.deleteFromList")}
                  aria-label={tStr("pages.profiles.deleteFromList")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}
