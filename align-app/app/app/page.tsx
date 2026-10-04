"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, X, ChevronRight, MessageCircle, Undo2, ShieldOff, Flag } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import {
  useSearchFilters,
  broadenSearchFilters,
  type SearchFilters,
} from "@/lib/useSearchFilters";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { SharedSearchFiltersPanel } from "@/components/SharedSearchFiltersPanel";
import { getUsableProfilePhotoUrls } from "@/lib/profileImage";
import { ProfilePhotoCountBars } from "@/components/ProfilePhotoCountBars";
import { AddFriendButton } from "@/components/AddFriendButton";
import { track } from "@/lib/tracking";
import { displayName } from "@/lib/displayName";
import { DiebelAppPromoCarousel } from "@/components/diebel/DiebelAppPromoCarousel";
import AdSlot from "@/components/AdSlot";
import { OptimizedImage } from "@/components/OptimizedImage";
import {
  buildFeed,
  getInitialIntervals,
  adjustAfterFastSwipeState,
  type FeedItem,
  type FeedItemProfile,
} from "@/lib/feedBuilder";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  applyDiscoverResumeOrder,
  clearDiscoverResume,
  discoverFiltersKey,
  peekDiscoverResume,
  saveDiscoverResume,
} from "@/lib/discoverResumeSession";
import { saveProfileReturnPath } from "@/lib/listScrollSession";
import { buildDiscoverApiQuery } from "@/lib/discoverSearchParams";
import { useVisibleInterval } from "@/lib/useVisibleInterval";
import { getPresencePollMs } from "@/lib/presencePollMs";
import { presenceKind } from "@/lib/presenceLabel";
import {
  getProfileCardChrome,
  FRIEND_CARD_COLORS,
} from "@/lib/friendCardStates";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { SkeletonSwipeCard } from "@/components/perceived/AppShellLoadingLayout";

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
  const { tStr, locale } = useI18n();
  const getDistanceDisplay = useCallback(
    (u: UserWithMeta): string => {
      if (u.distanceHidden || u.distanceKm == null) return tStr("pages.matches.distanceHidden");
      if (u.friendStatus === "accepted" && u.distanceKm < 1) return tStr("pages.matches.nearby");
      if (u.distanceKm! < 1) return `${Math.round(u.distanceKm! * 1000)} m`;
      return `${(Math.round(u.distanceKm! * 10) / 10).toFixed(1).replace(".", ",")} km`;
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
  const [filters, setFilters, filtersReady] = useSearchFilters(locale);
  const lastViewedId = useRef<string | null>(null);
  const cardShownAtRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  /** null = nedecis; h = swipe like/pass; v = scroll pagină (nu blocăm). */
  const swipeAxisRef = useRef<"h" | "v" | null>(null);
  const isDraggingRef = useRef(false);
  const swipeMaxAbsDeltaRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const photoAreaRef = useRef<HTMLDivElement>(null);
  const [cardPhotoIndex, setCardPhotoIndex] = useState(0);
  const [matchModal, setMatchModal] = useState<{ toId: string; name: string } | null>(null);
  const profileUndoStackRef = useRef<FeedItemProfile[]>([]);
  const [undoStackLength, setUndoStackLength] = useState(0);
  const autoRelaxedFiltersRef = useRef(false);
  const [discoverHint, setDiscoverHint] = useState<string | undefined>();
  const feedSeqRef = useRef(0);
  const feedAbortRef = useRef<AbortController | null>(null);

  const resetProfileUndoStack = useCallback(() => {
    profileUndoStackRef.current = [];
    setUndoStackLength(0);
  }, []);

  /** La tastare țară/oraș: scoatem imediat rezultatele vechi ca să nu apară Germania după ce ai scris România. */
  const onFilterPending = useCallback(() => {
    feedAbortRef.current?.abort();
    feedSeqRef.current += 1;
    setLoading(true);
    setFeedItems([]);
    resetProfileUndoStack();
  }, [resetProfileUndoStack]);
  const SWIPE_THRESHOLD = 55;
  const SWIPE_EXIT_OFFSET = 400;
  const FLY_OUT_MS = 100;
  /** Sub această mișcare orizontală, eliberarea e tratată ca tap → deschide profilul (nu swipe). */
  const TAP_OPEN_PROFILE_MAX_PX = 42;

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate?.(8)) return;
  };

  const currentItem = feedItems[0];
  const isProfile = currentItem?.type === "profile";
  const current = (isProfile ? currentItem.data : null) as UserWithMeta | undefined;

  const orderProfilesForResume = useCallback((profiles: UserWithMeta[], f: SearchFilters) => {
    const resume = peekDiscoverResume(discoverFiltersKey(f));
    if (!resume) return profiles;
    const ordered = applyDiscoverResumeOrder(profiles, resume);
    clearDiscoverResume();
    return ordered;
  }, []);

  const loadFeed = (f: SearchFilters, currentIntervals?: { internal: number; external: number }) => {
    feedAbortRef.current?.abort();
    const ac = new AbortController();
    feedAbortRef.current = ac;
    const seq = ++feedSeqRef.current;
    const query = buildDiscoverApiQuery(f);
    setLoading(true);
    setFeedItems([]);
    return fetchWithAuthRetry(`/api/feed${query}`, { cache: "no-store", signal: ac.signal })
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
        if (seq !== feedSeqRef.current) return;
        if (!data) {
          setFeedItems([]);
          setFeedConfig(null);
          setDiscoverHint(undefined);
          resetProfileUndoStack();
          setLoading(false);
          return;
        }
        setDiscoverHint((data as { discoverHint?: string }).discoverHint);
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
        const profiles = orderProfilesForResume(data.profiles, f);
        const items = buildFeed({
          profiles,
          internalAds: data.internalAds,
          isPremium: data.isPremium,
          minCardsBeforeAds: data.minCardsBeforeAds,
          internalInterval: iInt,
          externalInterval: iExt,
        });
        setFeedItems(items);
        resetProfileUndoStack();
        setLoading(false);
        if (profiles.length > 0) setRetriedAfterEmpty(false);
      })
      .catch((err: unknown) => {
        if (seq !== feedSeqRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFeedItems([]);
        setFeedConfig(null);
        resetProfileUndoStack();
        setLoading(false);
      });
  };

  const searchAgain = () => {
    setLoading(true);
    setRetriedAfterEmpty(true);
    loadFeed(filters);
  };

  const resetAllDiscoverFilters = () => {
    clearDiscoverResume();
    autoRelaxedFiltersRef.current = false;
    setRetriedAfterEmpty(false);
    setFilters((f) => broadenSearchFilters(f));
  };

  useEffect(() => {
    if (currentItem) cardShownAtRef.current = Date.now();
  }, [feedItems.length, currentItem?.type, isProfile ? current?.id : (currentItem && "data" in currentItem ? (currentItem as { data: { id?: string } }).data?.id : undefined)]);

  useEffect(() => {
    setCardPhotoIndex(0);
  }, [current?.id]);

  useEffect(() => {
    if (!current?.id || current.id === lastViewedId.current) return;
    lastViewedId.current = current.id;
    fetchWithAuthRetry("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: current.id }),
    })
      .then(() => track.view_profile(current.id))
      .catch(() => {});
  }, [current?.id]);

  useEffect(() => {
    if (!filtersReady) return;
    feedAbortRef.current?.abort();
    const ac = new AbortController();
    feedAbortRef.current = ac;
    const seq = ++feedSeqRef.current;
    setLoading(true);
    setFeedItems([]);
    resetProfileUndoStack();
    const queryFilters = filters;
    fetchWithAuthRetry(`/api/feed${buildDiscoverApiQuery(queryFilters)}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return null;
        return data as {
          profiles: UserWithMeta[];
          discoverHint?: string;
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
        if (seq !== feedSeqRef.current) return;
        if (!data) {
          setFeedItems([]);
          setDiscoverHint(undefined);
          resetProfileUndoStack();
          setLoading(false);
          return;
        }
        setDiscoverHint(data.discoverHint);
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
        const profiles = orderProfilesForResume(data.profiles, queryFilters);
        const items = buildFeed({
          profiles,
          internalAds: data.internalAds,
          isPremium: data.isPremium,
          minCardsBeforeAds: data.minCardsBeforeAds,
          internalInterval: initial.internal,
          externalInterval: initial.external,
        });
        setFeedItems(items);
        resetProfileUndoStack();
        if (profiles.length > 0) {
          setRetriedAfterEmpty(false);
          setLoading(false);
          return;
        }
        // Auto-relax DOAR pentru capcane tehnice (GPS / „doar online”), NU pentru
        // oraș/țară/gen/vârstă alese de utilizator — altfel filtrul părea că nu merge.
        const technicalTrap =
          queryFilters.onlineOnly || (Number(queryFilters.maxDistanceKm) || 0) > 0;
        if (autoRelaxedFiltersRef.current === false && technicalTrap) {
          autoRelaxedFiltersRef.current = true;
          setFilters((f) => ({
            ...f,
            onlineOnly: false,
            maxDistanceKm: "0",
          }));
          return;
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (seq !== feedSeqRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFeedItems([]);
        resetProfileUndoStack();
        setLoading(false);
      });
    return () => {
      ac.abort();
    };
  }, [filtersReady, filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy, resetProfileUndoStack, setFilters, orderProfilesForResume]);

  /** Actualizează online / lastActivity pe cardul curent fără să reconstruiască tot feed-ul (Discover nu avea polling — PC părea OK la refresh manual). */
  const refreshPresenceOnFeed = useCallback(() => {
    if (loading || !filtersReady) return;
    const queryFilters = filters;
    const seqAtStart = feedSeqRef.current;
    void fetchWithAuthRetry(`/api/profiles${buildDiscoverApiQuery(queryFilters)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((d: { profiles?: UserWithMeta[] }) => {
        if (seqAtStart !== feedSeqRef.current) return;
        const fresh = d.profiles;
        if (!fresh?.length) return;
        const byId = new Map(fresh.map((p) => [p.id, p]));
        setFeedItems((prev) =>
          prev.map((item) => {
            if (item.type !== "profile") return item;
            const row = item as FeedItemProfile;
            const profile = row.data as UserWithMeta;
            const meta = byId.get(profile.id);
            if (!meta) return item;
            return {
              ...row,
              data: {
                ...profile,
                online: meta.online,
                lastActivityAt: meta.lastActivityAt,
                friendStatus: meta.friendStatus ?? profile.friendStatus,
                match: meta.match ?? profile.match,
                visited: meta.visited ?? profile.visited,
                visitedByThem: meta.visitedByThem ?? profile.visitedByThem,
              },
            };
          })
        );
      })
      .catch(() => {});
  }, [filters, filtersReady, loading]);

  useVisibleInterval(refreshPresenceOnFeed, getPresencePollMs(), feedItems.length > 0 && !loading);

  /** Trece la următorul card; reține profilul pentru „Revenire” (fără limită). */
  const dismissCurrentFeedItem = useCallback(() => {
    setFeedItems((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      if (first.type === "profile") {
        profileUndoStackRef.current = [...profileUndoStackRef.current, first as FeedItemProfile];
      }
      return rest;
    });
    setUndoStackLength(profileUndoStackRef.current.length);
  }, []);

  const undoLastProfile = useCallback(() => {
    const arr = profileUndoStackRef.current;
    if (arr.length === 0) return;
    const restored = arr[arr.length - 1]!;
    profileUndoStackRef.current = arr.slice(0, -1);
    setUndoStackLength(profileUndoStackRef.current.length);
    setFeedItems((prev) => [restored, ...prev]);
    setDragOffset(0);
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const getClientPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    if ("touches" in e && e.touches.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const m = e as React.MouseEvent;
    return { x: m.clientX, y: m.clientY };
  };

  const isInteractiveSwipeTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest("button, a, [role='button'], input, textarea, select");

  const onSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isInteractiveSwipeTarget(e.target)) return;
    swipeMaxAbsDeltaRef.current = 0;
    swipeAxisRef.current = null;
    isDraggingRef.current = true;
    setIsDragging(true);
    const p = getClientPoint(e);
    dragStartX.current = p.x;
    dragStartY.current = p.y;
  };

  const onSwipeMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const p = getClientPoint(e);
    const dx = p.x - dragStartX.current;
    const dy = p.y - dragStartY.current;
    if (swipeAxisRef.current == null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      swipeAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      if (swipeAxisRef.current === "v") {
        // Scroll vertical pe poză / pagină — nu blocăm, nu mutăm cardul.
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragOffset(0);
        return;
      }
    }
    if (swipeAxisRef.current !== "h") return;
    const delta = Math.max(-260, Math.min(260, dx));
    swipeMaxAbsDeltaRef.current = Math.max(swipeMaxAbsDeltaRef.current, Math.abs(delta));
    setDragOffset(delta);
  };

  const openCurrentProfile = useCallback(() => {
    if (!current) return;
    const order = feedItems
      .filter((i): i is FeedItemProfile => i.type === "profile")
      .map((i) => (i.data as UserWithMeta).id)
      .filter(Boolean);
    saveDiscoverResume(current.id, order, discoverFiltersKey(filters));
    saveProfileReturnPath("/app");
    router.push(`/app/user/${current.id}`, { scroll: false });
  }, [current, feedItems, filters, router]);

  const onSwipeEnd = () => {
    const axis = swipeAxisRef.current;
    swipeAxisRef.current = null;
    if (!isDraggingRef.current && axis !== "h") {
      // Scroll vertical: nu deschide profilul.
      return;
    }
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const offset = dragOffset;
    const maxAbs = swipeMaxAbsDeltaRef.current;
    swipeMaxAbsDeltaRef.current = 0;
    if (axis === "v") {
      setDragOffset(0);
      return;
    }
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
        const photos = getUsableProfilePhotoUrls(current.photos);
        const area = photoAreaRef.current;
        if (photos.length > 1 && area) {
          const rect = area.getBoundingClientRect();
          const x = dragStartX.current;
          const y = dragStartY.current;
          const inside =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          if (inside) {
            const goPrev = x - rect.left < rect.width * 0.35;
            setCardPhotoIndex((i) => {
              if (goPrev) return Math.max(0, i - 1);
              return Math.min(photos.length - 1, i + 1);
            });
            return;
          }
        }
        openCurrentProfile();
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
      // Blochează scroll doar la swipe orizontal (like/pass), nu la scroll pe poză.
      if (isDraggingRef.current && swipeAxisRef.current === "h") e.preventDefault();
    };
    el.addEventListener("touchmove", preventScroll, { passive: false });
    return () => el.removeEventListener("touchmove", preventScroll);
  }, [current?.id]);

  const swipe = (toId: string, liked: boolean) => {
    const swipeDurationMs = Date.now() - cardShownAtRef.current;
    dismissCurrentFeedItem();

    (async () => {
      if (!liked && swipeDurationMs < FAST_SWIPE_MS) {
        setIntervals((prev) => adjustAfterFastSwipeState(prev));
      }
      const body: { toId: string; liked: boolean; internalInterval?: number; externalInterval?: number } = { toId, liked };
      if (liked) {
        body.internalInterval = intervals.internal;
        body.externalInterval = intervals.external;
      }
      const res = await fetchWithAuthRetry("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
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

  const handleBlockCurrent = async () => {
    if (!current) return;
    if (!confirm(tStr("pages.userPublic.blockConfirm"))) return;
    const toId = current.id;
    const res = await fetchWithAuthRetry("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: toId }),
    });
    if (res.ok) dismissCurrentFeedItem();
  };

  const handleReportCurrent = async () => {
    if (!current) return;
    const reason = window.prompt(tStr("pages.userPublic.reportPrompt"));
    if (reason === null) return;
    await fetchWithAuthRetry("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: current.id,
        reason: reason || tStr("pages.userPublic.reportReasonDefault"),
      }),
    });
  };

  const hasItems = feedItems.length > 0;

  return (
    <div className="flex flex-col items-center w-full min-w-0 max-w-full">
      {matchModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setMatchModal(null)}>
          <div className="app-pro-panel max-w-sm w-full p-6 shadow-2xl text-center border-dark-600/80" onClick={(e) => e.stopPropagation()}>
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
      <h2 className="app-pro-page-title mb-4 w-full">{tStr("pages.discover.title")}</h2>

      {filtersReady ? (
      <SharedSearchFiltersPanel
        filters={filters}
        onApply={setFilters}
        locale={locale}
        tStr={tStr}
        onReset={resetAllDiscoverFilters}
        onFilterPending={onFilterPending}
      />
      ) : null}

      <AdSlot variant="strip" />

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

      <div className="relative w-full max-w-sm mx-auto flex flex-col items-center min-h-[min(380px,58vh)]">
        {loading && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-dark-900/55 backdrop-blur-[2px] border border-dark-600/50 pointer-events-auto px-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <SkeletonSwipeCard />
            <span className="text-xs text-dark-400 px-4 text-center">{tStr("pages.discover.loadingFeed")}</span>
          </div>
        )}
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
                const cardPhotos = getUsableProfilePhotoUrls(current.photos);
                const safePhotoIndex =
                  cardPhotos.length === 0
                    ? 0
                    : Math.min(Math.max(0, cardPhotoIndex), cardPhotos.length - 1);
                const shownPhoto = cardPhotos[safePhotoIndex] ?? null;
                return (
              <div
                ref={cardRef}
                className="w-full max-w-sm select-none touch-pan-y"
                style={{ touchAction: "pan-y" }}
                title={tStr("pages.discover.cardSwipeTitle")}
                onMouseDown={onSwipeStart}
                onMouseMove={onSwipeMove}
                onMouseUp={onSwipeEnd}
                onMouseLeave={onSwipeEnd}
                onTouchStart={onSwipeStart}
                onTouchMove={onSwipeMove}
                onTouchEnd={onSwipeEnd}
                onTouchCancel={onSwipeEnd}
              >
                <div
                  className={`w-full h-[min(58dvh,480px)] sm:h-[min(62vh,520px)] rounded-2xl overflow-hidden bg-dark-800 relative card-hover will-change-transform ${cardChrome.borderClassName}`}
                  style={{
                    transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.06}deg)`,
                    transition: isDragging ? "none" : "transform 0.08s cubic-bezier(0.22, 1, 0.36, 1)",
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
                    className="absolute top-2 right-2 z-30 flex items-center gap-1.5 pointer-events-auto"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleBlockCurrent();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-amber-300 backdrop-blur-sm border border-white/15 active:scale-90 transition touch-manipulation"
                      title={tStr("pages.userPublic.blockUser")}
                      aria-label={tStr("pages.userPublic.blockUser")}
                    >
                      <ShieldOff className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleReportCurrent();
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-red-300 backdrop-blur-sm border border-white/15 active:scale-90 transition touch-manipulation"
                      title={tStr("pages.userPublic.reportUser")}
                      aria-label={tStr("pages.userPublic.reportUser")}
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                  </div>
                  <ProfilePhotoCountBars
                    count={cardPhotos.length}
                    activeIndex={safePhotoIndex}
                    onSelect={setCardPhotoIndex}
                    insetClassName="top-2.5 left-3 right-[5.75rem]"
                  />
                  <div
                    ref={photoAreaRef}
                    className={`absolute inset-0 ${cardChrome.dimPhoto ? "brightness-[0.88] saturate-[0.92]" : ""}`}
                  >
                    <SilhouetteAvatar
                      key={`${current.id}-${safePhotoIndex}`}
                      photoUrl={shownPhoto}
                      gender={current.gender}
                      name={current.name}
                      shape="rectangle"
                      className="absolute inset-0 w-full h-full"
                      imgClassName="w-full h-full object-cover object-[center_16%]"
                      imageSizes="(max-width: 480px) 100vw, (max-width: 640px) 90vw, 384px"
                    />
                  </div>

                  {/* Info pe poză — compact, fără butoane de acțiune peste text */}
                  <div className="absolute inset-x-0 bottom-0 z-20 px-3.5 pt-20 pb-3.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none [&>*]:pointer-events-auto">
                    <button
                      type="button"
                      onClick={openCurrentProfile}
                      className="text-left w-full touch-manipulation"
                    >
                      <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate [text-shadow:0_1px_3px_rgba(0,0,0,0.95)] flex items-center gap-2">
                        <span className="truncate">
                          {displayName(current.username ?? current.name)}
                          {current.age != null ? (
                            <span className="font-semibold text-white/90">, {current.age}</span>
                          ) : null}
                        </span>
                        {presenceKind(current.online, current.lastActivityAt) === "online" ? (
                          <span
                            className="shrink-0 inline-block w-2.5 h-2.5 rounded-full bg-green-400"
                            title={tStr("pages.messages.online")}
                            aria-label={tStr("pages.messages.online")}
                          />
                        ) : null}
                      </h3>
                    </button>

                    <p className="mt-1 text-sm text-white/90 truncate [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                      {[
                        current.gender === "male"
                          ? tStr("pages.discover.genderMale")
                          : current.gender === "female"
                            ? tStr("pages.discover.genderFemale")
                            : current.gender === "other"
                              ? tStr("pages.discover.genderOther")
                              : null,
                        current.city || null,
                        current.distanceHidden
                          ? tStr("pages.matches.distanceHidden")
                          : current.distanceKm != null
                            ? getDistanceDisplay(current)
                            : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {(current.match || current.isMatched) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/30 text-green-300 border border-green-400/50">
                          {tStr("pages.discover.badgeMatch")}
                        </span>
                      )}
                      {current.friendStatus === "accepted" && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#4DA6FF]/30 text-[#4DA6FF] border border-[#4DA6FF]/50">
                          {tStr("pages.discover.badgeFriends")}
                        </span>
                      )}
                      {current.friendStatus === "pending_received" && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#C77DFF]/30 text-[#C77DFF] border border-[#C77DFF]/50">
                          {tStr("pages.discover.badgeWantsFriend")}
                        </span>
                      )}
                      {current.isNew && (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: `${FRIEND_CARD_COLORS.isNew}22`,
                            color: FRIEND_CARD_COLORS.isNew,
                            borderColor: `${FRIEND_CARD_COLORS.isNew}80`,
                          }}
                        >
                          {tStr("pages.discover.legend.isNew")}
                        </span>
                      )}
                    </div>

                    {current.bio ? (
                      <p className="mt-1.5 text-sm text-white/90 line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.92)]">
                        {current.bio}
                      </p>
                    ) : null}

                    <div
                      className="mt-2"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <AddFriendButton
                        userId={current.id}
                        friendStatus={current.friendStatus ?? null}
                        onStatusChange={refreshCurrentUser}
                        variant="small"
                        className="bg-black/35 backdrop-blur-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Acțiuni sub card — nu se mai calcă pe text/poză */}
                <div
                  className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2 w-full"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onButtonSwipe(false)}
                    className="aspect-square max-h-14 rounded-full bg-dark-700 hover:bg-red-500/20 active:scale-95 flex items-center justify-center text-red-400 border border-red-500/45 transition touch-manipulation"
                    title={tStr("pages.discover.passTitle")}
                    aria-label={tStr("pages.discover.passTitle")}
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/chat/${current.id}`)}
                    className="aspect-square max-h-14 rounded-full bg-dark-700 hover:bg-brand-500/20 active:scale-95 flex items-center justify-center text-brand-400 border border-brand-500/45 transition touch-manipulation"
                    title={tStr("pages.discover.messagesTitle")}
                    aria-label={tStr("pages.discover.messagesTitle")}
                  >
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  <QuickCallButtons toUserId={current.id} size="discover" />
                  <button
                    type="button"
                    onClick={() => onButtonSwipe(true)}
                    className="aspect-square max-h-14 rounded-full bg-brand-500 hover:bg-brand-400 active:scale-95 flex items-center justify-center text-dark-900 border border-brand-400/50 transition touch-manipulation"
                    title={tStr("pages.discover.likeTitle")}
                    aria-label={tStr("pages.discover.likeTitle")}
                  >
                    <Heart className="w-6 h-6" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openCurrentProfile}
                  className="mt-2 w-full min-h-10 rounded-xl border border-dark-600 bg-dark-800/80 text-sm font-medium text-dark-200 hover:bg-dark-700 touch-manipulation"
                >
                  {tStr("pages.discover.viewProfileTitle")}
                </button>
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
                  onClick={dismissCurrentFeedItem}
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
                  onClick={dismissCurrentFeedItem}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition"
                >
                  {tStr("pages.discover.adNext")} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="w-full max-w-sm flex justify-center mt-4">
            <button
              type="button"
              onClick={undoLastProfile}
              disabled={undoStackLength === 0}
              title={tStr("pages.discover.backPreviousTitle")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dark-600 bg-dark-800 text-dark-200 text-sm font-medium hover:bg-dark-700 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition touch-manipulation"
            >
              <Undo2 className="w-4 h-4 shrink-0" aria-hidden />
              <span>{tStr("pages.discover.backPreviousProfile")}</span>
            </button>
          </div>
        </>
      ) : !loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center w-full">
          <p className="text-dark-500 max-w-sm mb-4">
            {discoverHint === "no_other_users"
              ? tStr("pages.discover.emptyNoOthers")
              : discoverHint === "adjust_filters_or_review"
                ? tStr("pages.discover.emptyAdjustFilters")
                : !retriedAfterEmpty
                  ? tStr("pages.discover.emptyRetry")
                  : tStr("pages.discover.emptyDone")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={searchAgain}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors touch-manipulation"
            >
              {tStr("pages.discover.searchAgain")}
            </button>
            <button
              type="button"
              onClick={resetAllDiscoverFilters}
              className="px-4 py-2 rounded-lg border border-dark-600 bg-dark-800 text-dark-200 hover:bg-dark-700 transition-colors touch-manipulation"
            >
              {tStr("pages.discover.showAllUsers")}
            </button>
          </div>
          {discoverHint === "adjust_filters_or_review" && (
            <Link
              href="/app/review-swipes"
              className="mt-3 text-sm text-brand-400 hover:text-brand-300 underline touch-manipulation"
            >
              {tStr("pages.discover.reviewSwipesCta")}
            </Link>
          )}
          {undoStackLength > 0 && (
            <button
              type="button"
              onClick={undoLastProfile}
              title={tStr("pages.discover.backPreviousTitle")}
              className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dark-600 bg-dark-800 text-dark-200 text-sm font-medium hover:bg-dark-700 hover:text-white transition touch-manipulation"
            >
              <Undo2 className="w-4 h-4 shrink-0" aria-hidden />
              <span>{tStr("pages.discover.backPreviousProfile")}</span>
            </button>
          )}
        </div>
      ) : null}
      </div>

    </div>
  );
}
