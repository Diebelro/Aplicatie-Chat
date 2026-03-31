"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Heart, X, ChevronRight, MessageCircle } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { useSearchFilters, type SearchFilters } from "@/lib/useSearchFilters";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { AddFriendButton } from "@/components/AddFriendButton";
import { track } from "@/lib/tracking";
import { displayName } from "@/lib/displayName";
import { DiebelAppPromoCarousel } from "@/components/diebel/DiebelAppPromoCarousel";
import { OptimizedImage } from "@/components/OptimizedImage";
import {
  buildFeed,
  getInitialIntervals,
  adjustAfterFastSwipeState,
  type FeedItem,
} from "@/lib/feedBuilder";
import { getAuthHeaders } from "@/lib/authClient";
import { MAX_PROFILE_SEARCH_RADIUS_KM } from "@/lib/profileSearchConstants";
import {
  getSmallCardState,
  getProfileCardChrome,
  FRIEND_CARD_COLORS,
} from "@/lib/friendCardStates";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";

type UserWithMeta = User & {
  online?: boolean;
  isNew?: boolean;
  distanceKm?: number;
  distanceHidden?: boolean;
  lastActivityAt?: number;
  visited?: boolean;
  visitedByThem?: boolean;
  sentMessage?: boolean;
  receivedMessage?: boolean;
  messageSeen?: boolean;
  friendStatus?: "pending_sent" | "pending_received" | "accepted" | "rejected" | null;
  match?: boolean;
  /** TEST_MODE: status swipe + conversație */
  hasLiked?: boolean;
  hasDisliked?: boolean;
  isMatched?: boolean;
  hasMessages?: boolean;
};

function buildQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.gender) p.set("gender", f.gender);
  if (f.minAge) p.set("minAge", f.minAge);
  if (f.maxAge) p.set("maxAge", f.maxAge);
  const md = f.maxDistanceKm.trim();
  if (md !== "" && md !== "0") {
    const n = Number(md);
    if (!Number.isNaN(n) && n > 0) {
      p.set("maxDistanceKm", String(Math.min(MAX_PROFILE_SEARCH_RADIUS_KM, n)));
    }
  }
  if (f.country?.trim()) p.set("country", f.country.trim());
  if (f.city.trim()) p.set("city", f.city.trim());
  if (f.onlineOnly) p.set("onlineOnly", "true");
  if (f.name.trim()) p.set("name", f.name.trim());
  if (f.sortBy) p.set("sortBy", f.sortBy);
  const q = p.toString();
  return q ? `?${q}` : "";
}

const FAST_SWIPE_MS = 2500;

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

export default function AppDiscoverPage() {
  const { tStr } = useI18n();
  const getDistanceDisplay = useCallback(
    (u: UserWithMeta): string => {
      if (u.distanceHidden || u.distanceKm == null) return tStr("pages.matches.distanceHidden");
      if (u.friendStatus === "accepted" && u.distanceKm < 1) return tStr("pages.matches.nearby");
      if (u.distanceKm! < 1) return `${Math.round(u.distanceKm! * 1000)} m`;
      return `${(Math.round(u.distanceKm! * 10) / 10).toFixed(1).replace(".", ",")} km`;
    },
    [tStr]
  );
  const formatLastActive = useCallback(
    (ts: number | undefined): string => {
      if (!ts) return "";
      const min = Math.floor((Date.now() - ts) / 60000);
      if (min < 1) return tStr("pages.discover.lastNow");
      if (min === 1) return tStr("pages.discover.last1min");
      if (min < 60) return formatTpl(tStr("pages.discover.lastNmin"), { n: min });
      const h = Math.floor(min / 60);
      if (h === 1) return tStr("pages.discover.last1h");
      return formatTpl(tStr("pages.discover.lastNh"), { n: h });
    },
    [tStr]
  );

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retriedAfterEmpty, setRetriedAfterEmpty] = useState(false);
  const [intervals, setIntervals] = useState<{ internal: number; external: number }>({ internal: 12, external: 22 });
  const [feedConfig, setFeedConfig] = useState<{
    internalAdIntervalMin: number;
    internalAdIntervalMax: number;
    externalAdIntervalMin: number;
    externalAdIntervalMax: number;
    minCardsBeforeAds: number;
  } | null>(null);
  const router = useRouter();
  const [filters, setFilters] = useSearchFilters();
  const [debouncedName, setDebouncedName] = useState(filters.name);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(filters.name), 600);
    return () => clearTimeout(t);
  }, [filters.name]);
  const lastViewedId = useRef<string | null>(null);
  const cardShownAtRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const isDraggingRef = useRef(false);
  const swipeMaxAbsDeltaRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [matchModal, setMatchModal] = useState<{ toId: string; name: string } | null>(null);
  const SWIPE_THRESHOLD = 55;
  const SWIPE_EXIT_OFFSET = 400;
  const FLY_OUT_MS = 100;
  /** Sub această mișcare orizontală, eliberarea e tratată ca tap → deschide profilul (nu swipe). */
  const TAP_OPEN_PROFILE_MAX_PX = 18;

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate?.(8)) return;
  };

  const currentItem = feedItems[0];
  const isProfile = currentItem?.type === "profile";
  const current = (isProfile ? currentItem.data : null) as UserWithMeta | undefined;

  const loadFeed = (f: SearchFilters, currentIntervals?: { internal: number; external: number }) => {
    const query = buildQuery(f);
    return fetch(`/api/feed${query}`, { headers: getAuthHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return null;
        return data as {
          profiles: UserWithMeta[];
          internalAds: { id: string; imageUrl?: string; link?: string; alt?: string; country?: string }[];
          isPremium: boolean;
          minCardsBeforeAds: number;
          internalAdIntervalMin: number;
          internalAdIntervalMax: number;
          externalAdIntervalMin: number;
          externalAdIntervalMax: number;
        };
      })
      .then((data) => {
        if (!data) {
          setFeedItems([]);
          setFeedConfig(null);
          setLoading(false);
          return;
        }
        setFeedConfig({
          internalAdIntervalMin: data.internalAdIntervalMin,
          internalAdIntervalMax: data.internalAdIntervalMax,
          externalAdIntervalMin: data.externalAdIntervalMin,
          externalAdIntervalMax: data.externalAdIntervalMax,
          minCardsBeforeAds: data.minCardsBeforeAds,
        });
        const { internal: iInt, external: iExt } = currentIntervals ?? getInitialIntervals(
          data.internalAdIntervalMin,
          data.internalAdIntervalMax,
          data.externalAdIntervalMin,
          data.externalAdIntervalMax
        );
        if (!currentIntervals) setIntervals({ internal: iInt, external: iExt });
        const items = buildFeed({
          profiles: data.profiles,
          internalAds: data.internalAds,
          isPremium: data.isPremium,
          minCardsBeforeAds: data.minCardsBeforeAds,
          internalInterval: iInt,
          externalInterval: iExt,
        });
        setFeedItems(items);
        setLoading(false);
        if (data.profiles.length > 0) setRetriedAfterEmpty(false);
      })
      .catch(() => {
        setFeedItems([]);
        setFeedConfig(null);
        setLoading(false);
      });
  };

  const searchAgain = () => {
    setLoading(true);
    setRetriedAfterEmpty(true);
    loadFeed(filters);
  };

  useEffect(() => {
    if (currentItem) cardShownAtRef.current = Date.now();
  }, [feedItems.length, currentItem?.type, isProfile ? current?.id : (currentItem && "data" in currentItem ? (currentItem as { data: { id?: string } }).data?.id : undefined)]);

  useEffect(() => {
    if (!current?.id || current.id === lastViewedId.current) return;
    lastViewedId.current = current.id;
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ profileId: current.id }),
    }).then(() => track.view_profile(current.id)).catch(() => {});
  }, [current?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const queryFilters = { ...filters, name: debouncedName };
    fetch(`/api/feed${buildQuery(queryFilters)}`, { headers: getAuthHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return null;
        return data as {
          profiles: UserWithMeta[];
          internalAds: { id: string; imageUrl?: string; link?: string; alt?: string }[];
          isPremium: boolean;
          minCardsBeforeAds: number;
          internalAdIntervalMin: number;
          internalAdIntervalMax: number;
          externalAdIntervalMin: number;
          externalAdIntervalMax: number;
        };
      })
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled) setFeedItems([]);
          setLoading(false);
          return;
        }
        setFeedConfig({
          internalAdIntervalMin: data.internalAdIntervalMin,
          internalAdIntervalMax: data.internalAdIntervalMax,
          externalAdIntervalMin: data.externalAdIntervalMin,
          externalAdIntervalMax: data.externalAdIntervalMax,
          minCardsBeforeAds: data.minCardsBeforeAds,
        });
        const initial = getInitialIntervals(
          data.internalAdIntervalMin,
          data.internalAdIntervalMax,
          data.externalAdIntervalMin,
          data.externalAdIntervalMax
        );
        setIntervals(initial);
        const items = buildFeed({
          profiles: data.profiles,
          internalAds: data.internalAds,
          isPremium: data.isPremium,
          minCardsBeforeAds: data.minCardsBeforeAds,
          internalInterval: initial.internal,
          externalInterval: initial.external,
        });
        setFeedItems(items);
        if (data.profiles.length > 0) setRetriedAfterEmpty(false);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setFeedItems([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, debouncedName, filters.sortBy]);

  const advanceToNext = () => {
    setFeedItems((prev) => prev.slice(1));
  };

  const getClientX = (e: React.MouseEvent | React.TouchEvent): number =>
    "touches" in e && e.touches.length ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

  const isInteractiveSwipeTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest("button, a, [role='button'], input, textarea, select");

  const onSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isInteractiveSwipeTarget(e.target)) return;
    swipeMaxAbsDeltaRef.current = 0;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartX.current = getClientX(e);
  };

  const onSwipeMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const x = "touches" in e && e.touches.length ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const delta = Math.max(-260, Math.min(260, x - dragStartX.current));
    swipeMaxAbsDeltaRef.current = Math.max(swipeMaxAbsDeltaRef.current, Math.abs(delta));
    setDragOffset(delta);
  };

  const onSwipeEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const offset = dragOffset;
    const maxAbs = swipeMaxAbsDeltaRef.current;
    swipeMaxAbsDeltaRef.current = 0;
    if (Math.abs(offset) >= SWIPE_THRESHOLD && current) {
      triggerHaptic();
      const liked = offset > 0;
      const toId = current.id;
      setDragOffset(liked ? SWIPE_EXIT_OFFSET : -SWIPE_EXIT_OFFSET);
      setTimeout(() => {
        swipe(toId, liked);
        setDragOffset(0);
      }, FLY_OUT_MS);
    } else {
      setDragOffset(0);
      const feelsLikeTap =
        maxAbs < TAP_OPEN_PROFILE_MAX_PX && Math.abs(offset) < SWIPE_THRESHOLD;
      if (feelsLikeTap && current) {
        router.push(`/app/user/${current.id}`);
      }
    }
  };

  const onButtonSwipe = (liked: boolean) => {
    if (!current) return;
    triggerHaptic();
    setDragOffset(liked ? SWIPE_EXIT_OFFSET : -SWIPE_EXIT_OFFSET);
    setIsDragging(false);
    setTimeout(() => {
      swipe(current.id, liked);
      setDragOffset(0);
    }, FLY_OUT_MS);
  };

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const preventScroll = (e: TouchEvent) => {
      if (isDraggingRef.current) e.preventDefault();
    };
    el.addEventListener("touchmove", preventScroll, { passive: false });
    return () => el.removeEventListener("touchmove", preventScroll);
  }, [current?.id]);

  const swipe = (toId: string, liked: boolean) => {
    const swipeDurationMs = Date.now() - cardShownAtRef.current;
    advanceToNext();

    (async () => {
      if (!liked && swipeDurationMs < FAST_SWIPE_MS) {
        setIntervals((prev) => adjustAfterFastSwipeState(prev));
      }
      const body: { toId: string; liked: boolean; internalInterval?: number; externalInterval?: number } = { toId, liked };
      if (liked) {
        body.internalInterval = intervals.internal;
        body.externalInterval = intervals.external;
      }
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (liked) track.like_sent(toId);
      if (data.matchCreated) {
        track.match_created(toId);
        const name =
          current
            ? displayName(current.name ?? current.username ?? "") || tStr("pages.reviewSwipes.someone")
            : tStr("pages.reviewSwipes.someone");
        setMatchModal({ toId, name });
      }
      if (typeof data.internalInterval === "number" && typeof data.externalInterval === "number") {
        setIntervals({ internal: data.internalInterval, external: data.externalInterval });
      }
    })();
  };

  const refreshCurrentUser = () => {
    loadFeed(filters, intervals);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">{tStr("pages.discover.loadingFeed")}</span>
      </div>
    );
  }

  const hasItems = feedItems.length > 0;
  const profilesRemaining = feedItems.filter((i) => i.type === "profile").length;

  return (
    <div className="flex flex-col items-center w-full">
      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setMatchModal(null)}>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 max-w-sm w-full shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold text-zinc-900 mb-1">{tStr("pages.reviewSwipes.matchTitle")}</p>
            <p className="text-dark-300 mb-6">
              {formatTpl(tStr("pages.reviewSwipes.matchBody"), { name: matchModal.name })}
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMatchModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-dark-600 text-dark-300 hover:bg-dark-700"
                >
                  {tStr("pages.discover.matchStay")}
                </button>
                <button
                  type="button"
                  onClick={() => { router.push(`/app/chat/${matchModal.toId}`); setMatchModal(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 text-zinc-900 font-medium hover:bg-brand-600"
                >
                  {tStr("pages.discover.sendMessage")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { router.push(`/app/review-swipes?focus=${encodeURIComponent(matchModal.toId)}`); setMatchModal(null); }}
                className="w-full py-2.5 rounded-xl border border-amber-500/40 text-amber-400/95 text-sm hover:bg-amber-500/10"
              >
                {tStr("pages.discover.reviewSwipesCta")}
              </button>
            </div>
          </div>
        </div>
      )}
      <h2 className="text-xl font-semibold mb-4 w-full">{tStr("pages.discover.title")}</h2>

      <div className="w-full mb-6 p-4 rounded-xl bg-dark-800 border border-dark-600">
        <p className="text-sm text-dark-400 mb-3">{tStr("pages.discover.filterHint")}</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.nameLabel")}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={tStr("pages.discover.searchPlaceholder")}
                value={filters.name}
                onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                className="w-40 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {filters.name !== debouncedName && filters.name.trim() !== "" && (
                <span className="text-xs text-dark-500">{tStr("pages.discover.searching")}</span>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlineOnly}
              onChange={(e) => setFilters((f) => ({ ...f, onlineOnly: e.target.checked }))}
              className="rounded border-dark-600 bg-dark-700 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-dark-400">{tStr("pages.discover.onlineOnly")}</span>
          </label>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.genderLabel")}</label>
            <select
              value={filters.gender}
              onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
              className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">{tStr("pages.discover.genderAll")}</option>
              <option value="male">{tStr("pages.discover.genderMale")}</option>
              <option value="female">{tStr("pages.discover.genderFemale")}</option>
              <option value="other">{tStr("pages.discover.genderOther")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.minAge")}</label>
            <input
              type="number"
              min={18}
              max={filters.maxAge ? Math.min(100, Number(filters.maxAge)) : 100}
              placeholder="18"
              value={filters.minAge}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((f) => {
                  const minNum = v === "" ? 18 : Math.max(18, Math.min(100, Number(v) || 18));
                  const maxNum = f.maxAge ? Number(f.maxAge) : 100;
                  const minAge = v;
                  const maxAge = f.maxAge && minNum > maxNum ? String(minNum) : f.maxAge;
                  return { ...f, minAge, maxAge };
                });
              }}
              className="w-20 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.maxAge")}</label>
            <input
              type="number"
              min={filters.minAge ? Math.max(18, Number(filters.minAge)) : 18}
              max={100}
              placeholder="100"
              value={filters.maxAge}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((f) => {
                  const maxNum = v === "" ? 100 : Math.max(18, Math.min(100, Number(v) || 100));
                  const minNum = f.minAge ? Number(f.minAge) : 18;
                  const maxAge = v;
                  const minAge = f.minAge && maxNum < minNum ? String(maxNum) : f.minAge;
                  return { ...f, minAge, maxAge };
                });
              }}
              className="w-20 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.maxDistKm")}</label>
            <input
              type="number"
              min={0}
              max={MAX_PROFILE_SEARCH_RADIUS_KM}
              placeholder="0"
              value={filters.maxDistanceKm}
              onChange={(e) => setFilters((f) => ({ ...f, maxDistanceKm: e.target.value }))}
              className="w-24 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.countryLabel")}</label>
            <input
              type="text"
              placeholder={tStr("pages.discover.countryPlaceholder")}
              value={filters.country}
              onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
              className="w-36 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.cityLabel")}</label>
            <input
              type="text"
              placeholder={tStr("pages.discover.cityPlaceholder")}
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              className="w-36 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 gap-x-4 mb-4 w-full text-xs text-dark-500 justify-center">
        {LEGEND_KEYS.map((key) => {
          const color = FRIEND_CARD_COLORS[key as keyof typeof FRIEND_CARD_COLORS];
          return (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded border shrink-0"
                style={{ borderColor: `${color}80`, backgroundColor: `${color}1A` }}
              />
              {tStr(`pages.discover.legend.${key}`)}
            </span>
          );
        })}
        <span className="w-full text-center sm:w-auto basis-full sm:basis-auto">
          {tStr("pages.discover.distanceNote")}
        </span>
      </div>

      {hasItems ? (
        <>
          {currentItem.type === "profile" && current &&
            (() => {
                const cardChrome = getProfileCardChrome({
                  friendStatus: current.friendStatus ?? null,
                  match: !!(current.match || current.isMatched),
                  messageSeen: current.messageSeen,
                  receivedMessage: current.receivedMessage,
                  visitedByThem: current.visitedByThem,
                  visited: current.visited,
                  online: current.online,
                  isNew: current.isNew,
                });
                return (
              <div
                ref={cardRef}
                className="w-full max-w-sm touch-none select-none"
                style={{ touchAction: "none" }}
                title={tStr("pages.discover.cardSwipeTitle")}
                onMouseDown={onSwipeStart}
                onMouseMove={onSwipeMove}
                onMouseUp={onSwipeEnd}
                onMouseLeave={onSwipeEnd}
                onTouchStart={onSwipeStart}
                onTouchMove={onSwipeMove}
                onTouchEnd={onSwipeEnd}
              >
                <div
                  className={`w-full aspect-[3/4] rounded-2xl overflow-hidden bg-dark-800 relative card-hover will-change-transform ${cardChrome.borderClassName}`}
                  style={{
                    transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.06}deg)`,
                    transition: isDragging ? "none" : "transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)",
                    ...cardChrome.frameStyle,
                  }}
                >
                {Math.abs(dragOffset) > 25 && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none z-10 ${
                      dragOffset > 0 ? "bg-brand-500/20" : "bg-red-500/20"
                    }`}
                    aria-hidden
                  >
                    <span
                      className={`text-2xl font-black uppercase tracking-widest border-2 rounded-xl px-6 py-2 ${
                        dragOffset > 0
                          ? "text-brand-400 border-brand-400/80"
                          : "text-red-400 border-red-400/80"
                      }`}
                    >
                      {dragOffset > 0 ? tStr("pages.discover.swipeLike") : tStr("pages.discover.swipeNope")}
                    </span>
                  </div>
                )}
                <div
                  className={`absolute inset-0 ${cardChrome.dimPhoto ? "brightness-[0.88] saturate-[0.92]" : ""}`}
                >
                {current.photos?.[0] ? (
                  <OptimizedImage
                    src={current.photos[0]}
                    alt=""
                    fill
                    sizes="(max-width: 480px) 100vw, 384px"
                    className="object-cover"
                  />
                ) : null}
                {!current.photos?.[0] && (
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    <SilhouetteAvatar
                      photoUrl={null}
                      gender={current.gender}
                      name={current.name}
                      className="w-full max-w-[70%] h-full max-h-[70%] text-dark-600"
                    />
                  </div>
                )}
                </div>
                <div className="absolute inset-0 px-5 pt-5 pb-36 sm:pb-32 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/50 to-transparent pointer-events-none [&>_*]:pointer-events-auto">
                  <h3 className="text-2xl font-bold text-zinc-900 mb-1 pr-14 sm:pr-16 line-clamp-2">{displayName(current.username ?? current.name)}</h3>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {current.friendStatus === "accepted" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#4DA6FF]/30 text-[#4DA6FF] border border-[#4DA6FF]/50">
                        {tStr("pages.discover.badgeFriends")}
                      </span>
                    )}
                    {current.friendStatus === "pending_sent" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#A0A0A0]/30 text-[#A0A0A0] border border-[#A0A0A0]/50">
                        {tStr("pages.discover.badgePendingSent")}
                      </span>
                    )}
                    {current.friendStatus === "pending_received" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#C77DFF]/30 text-[#C77DFF] border border-[#C77DFF]/50">
                        {tStr("pages.discover.badgeWantsFriend")}
                      </span>
                    )}
                    {current.hasLiked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/30 text-brand-400 border border-brand-400/50">
                        {tStr("pages.discover.badgeLiked")}
                      </span>
                    )}
                    {current.hasDisliked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-dark-600 text-dark-400 border border-dark-500">
                        {tStr("pages.discover.badgeDisliked")}
                      </span>
                    )}
                    {(current.match || current.isMatched) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/30 text-green-400 border border-green-400/50">
                        {tStr("pages.discover.badgeMatch")}
                      </span>
                    )}
                    {current.hasMessages && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#22B8CF]/30 text-[#22B8CF] border border-[#22B8CF]/50">
                        {tStr("pages.discover.badgeChat")}
                      </span>
                    )}
                    {(() => {
                      const { statusKey } = getSmallCardState({
                        friendStatus: current.friendStatus ?? null,
                        match: !!(current.match || current.isMatched),
                        messageSeen: current.messageSeen,
                        receivedMessage: current.receivedMessage,
                        visitedByThem: current.visitedByThem,
                        visited: current.visited,
                        online: current.online,
                        isNew: current.isNew,
                      });
                      if (statusKey !== "online" && statusKey !== "isNew" && statusKey !== "notVisited") return null;
                      const color = statusKey === "online" ? FRIEND_CARD_COLORS.online : statusKey === "isNew" ? FRIEND_CARD_COLORS.isNew : FRIEND_CARD_COLORS.notVisited;
                      const label = tStr(`pages.discover.legend.${statusKey}`);
                      return (
                        <span
                          key={statusKey}
                          className="text-xs px-2 py-0.5 rounded-full border"
                          style={{ backgroundColor: `${color}20`, color, borderColor: `${color}80` }}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-gray-400 text-xs mb-1">
                    {current.age != null && (
                      <span>{formatTpl(tStr("pages.discover.ageYears"), { n: current.age })}</span>
                    )}
                    {current.age != null && (current.gender || current.height || current.weight || current.bodyType || current.eyeColor || current.hairColor || current.city) && " · "}
                    {current.gender === "male" && tStr("pages.discover.genderMale")}
                    {current.gender === "female" && tStr("pages.discover.genderFemale")}
                    {current.gender === "other" && tStr("pages.discover.genderOther")}
                    {current.height != null && ` · ${current.height} cm`}
                    {current.weight != null && ` · ${current.weight} kg`}
                    {current.bodyType && ` · ${current.bodyType}`}
                    {current.eyeColor && ` · ${formatTpl(tStr("pages.discover.eyePrefix"), { v: current.eyeColor })}`}
                    {current.hairColor && ` · ${formatTpl(tStr("pages.discover.hairPrefix"), { v: current.hairColor })}`}
                    {current.city && ` · ${current.city}`}
                    {current.distanceHidden && ` · ${tStr("pages.matches.distanceHidden")}`}
                    {!current.distanceHidden && current.distanceKm != null && ` · ${getDistanceDisplay(current)}`}
                  </p>
                  <div className="mb-2 z-[1]">
                    <AddFriendButton
                      userId={current.id}
                      friendStatus={current.friendStatus ?? null}
                      onStatusChange={refreshCurrentUser}
                      variant="big"
                    />
                  </div>
                  <p className="text-gray-300 text-sm line-clamp-2 sm:line-clamp-3 mb-2">
                    {current.bio || tStr("pages.discover.bioNone")}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-0">
                    {current.visitedByThem && (
                      <span className="text-[#9D4EDD]">{tStr("pages.discover.visitedYou")}</span>
                    )}
                    {current.messageSeen && (
                      <span className="text-[#22B8CF]">{tStr("pages.discover.sawYourMessage")}</span>
                    )}
                    {current.online && (
                      <span style={{ color: FRIEND_CARD_COLORS.online }}>{tStr("pages.messages.online")}</span>
                    )}
                    {!current.online && current.lastActivityAt != null && (
                      <span>{formatLastActive(current.lastActivityAt)}</span>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-3 left-0 right-0 z-20 flex flex-wrap justify-center items-center gap-2 sm:gap-3 px-1 pb-1 max-w-full">
                  <button
                    type="button"
                    onClick={() => onButtonSwipe(false)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-dark-600 hover:bg-red-500/25 active:scale-90 flex items-center justify-center text-red-400 border-2 border-red-500/50 transition-[transform,background-color] duration-75 touch-none shrink-0"
                    title={tStr("pages.discover.passTitle")}
                  >
                    <X className="w-6 h-6 sm:w-7 sm:h-7" />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/chat/${current.id}`)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-dark-600 hover:bg-brand-500/25 active:scale-90 flex items-center justify-center text-brand-400 border-2 border-brand-500/50 transition-[transform,background-color] duration-75 touch-none shrink-0"
                    title={tStr("pages.discover.messagesTitle")}
                  >
                    <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
                  </button>
                  <QuickCallButtons toUserId={current.id} size="discover" className="touch-none" />
                  <button
                    type="button"
                    onClick={() => onButtonSwipe(true)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-500 hover:bg-brand-400 active:scale-90 flex items-center justify-center text-dark-900 border-2 border-brand-400/50 transition-[transform,background-color] duration-75 touch-none shrink-0"
                    title={tStr("pages.discover.likeTitle")}
                  >
                    <Heart className="w-6 h-6 sm:w-7 sm:h-7" />
                  </button>
                </div>
                </div>
              </div>
                );
              })()}

          {currentItem.type === "internal_ad" && (
            <div className="w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 relative flex flex-col">
              <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                {currentItem.data.imageUrl ? (
                  <a
                    href={currentItem.data.link || "#"}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="block relative w-full h-full min-h-[200px]"
                  >
                    <OptimizedImage
                      src={currentItem.data.imageUrl}
                      alt={currentItem.data.alt || tStr("pages.discover.adAlt")}
                      fill
                      sizes="384px"
                      className="w-full h-full object-contain"
                    />
                  </a>
                ) : (
                  <span className="text-dark-500 text-sm">{tStr("pages.discover.adLabel")}</span>
                )}
              </div>
              <div className="p-3 border-t border-dark-600 flex justify-end">
                <button
                  onClick={advanceToNext}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition"
                >
                  {tStr("pages.discover.adNext")} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {currentItem.type === "external_ad" && (
            <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 relative flex flex-col">
              <div className="flex-1 min-h-[180px] w-full flex items-center justify-center px-1 py-2 sm:min-h-[200px]">
                <DiebelAppPromoCarousel compact hideIfPremium />
              </div>
              <div className="p-3 border-t border-dark-600 flex justify-end">
                <button
                  onClick={advanceToNext}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition"
                >
                  {tStr("pages.discover.adNext")} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <p className="text-dark-500 text-sm mt-4">
            {formatTpl(tStr("pages.discover.profilesLeft"), { n: profilesRemaining })}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center w-full">
          {!retriedAfterEmpty ? (
            <>
              <p className="text-dark-500 max-w-sm mb-4">{tStr("pages.discover.emptyRetry")}</p>
              <button
                onClick={searchAgain}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {tStr("pages.discover.searchAgain")}
              </button>
            </>
          ) : (
            <>
              <p className="text-dark-500 max-w-sm mb-4">{tStr("pages.discover.emptyDone")}</p>
              <button
                onClick={searchAgain}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {tStr("pages.discover.searchAgain")}
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
}
