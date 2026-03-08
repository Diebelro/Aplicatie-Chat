"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Heart, X, ChevronRight } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { useSearchFilters, type SearchFilters } from "@/lib/useSearchFilters";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { AddFriendButton } from "@/components/AddFriendButton";
import { track } from "@/lib/tracking";
import { displayName } from "@/lib/displayName";
import AdSlot from "@/components/AdSlot";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import {
  buildFeed,
  getInitialIntervals,
  adjustAfterFastSwipeState,
  type FeedItem,
} from "@/lib/feedBuilder";
import { getAuthHeaders } from "@/lib/authClient";

type UserWithMeta = User & {
  online?: boolean;
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
};

function getDistanceDisplay(u: UserWithMeta): string {
  if (u.distanceHidden || u.distanceKm == null) return "Distanță ascunsă";
  if (u.friendStatus === "accepted" && u.distanceKm < 1) return "În apropiere";
  if (u.distanceKm! < 1) return `${Math.round(u.distanceKm! * 1000)} m`;
  return `${(Math.round(u.distanceKm! * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

function buildQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.gender) p.set("gender", f.gender);
  if (f.minAge) p.set("minAge", f.minAge);
  if (f.maxAge) p.set("maxAge", f.maxAge);
  if (f.maxDistanceKm) p.set("maxDistanceKm", f.maxDistanceKm);
  if (f.country?.trim()) p.set("country", f.country.trim());
  if (f.city.trim()) p.set("city", f.city.trim());
  if (f.onlineOnly) p.set("onlineOnly", "true");
  if (f.name.trim()) p.set("name", f.name.trim());
  if (f.sortBy) p.set("sortBy", f.sortBy);
  const q = p.toString();
  return q ? `?${q}` : "";
}

function formatLastActive(ts: number | undefined): string {
  if (!ts) return "";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "Acum";
  if (min === 1) return "Acum 1 minut";
  if (min < 60) return `Acum ${min} minute`;
  const h = Math.floor(min / 60);
  if (h === 1) return "Acum 1 oră";
  return `Acum ${h} ore`;
}

const FAST_SWIPE_MS = 2500;

export default function AppDiscoverPage() {
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
  const { consent } = useCookieConsent();
  const [filters, setFilters] = useSearchFilters();
  const lastViewedId = useRef<string | null>(null);
  const cardShownAtRef = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const isDraggingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 55;
  const SWIPE_EXIT_OFFSET = 400;
  const FLY_OUT_MS = 100;

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
    fetch(`/api/feed${buildQuery(filters)}`, { headers: getAuthHeaders() })
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
  }, [filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy]);

  const advanceToNext = () => {
    setFeedItems((prev) => prev.slice(1));
  };

  const getClientX = (e: React.MouseEvent | React.TouchEvent): number =>
    "touches" in e && e.touches.length ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

  const onSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartX.current = getClientX(e);
  };

  const onSwipeMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const x = "touches" in e && e.touches.length ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const delta = Math.max(-260, Math.min(260, x - dragStartX.current));
    setDragOffset(delta);
  };

  const onSwipeEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const offset = dragOffset;
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
        router.push(`/app/chat/${toId}`);
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
        <span className="text-dark-500">Se încarcă feed...</span>
      </div>
    );
  }

  const hasItems = feedItems.length > 0;
  const profilesRemaining = feedItems.filter((i) => i.type === "profile").length;

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-xl font-semibold mb-4 w-full">Descoperă</h2>

      <div className="w-full mb-6 p-4 rounded-xl bg-dark-800 border border-dark-600">
        <p className="text-sm text-dark-400 mb-3">Filtrează după gen, vârstă, distanță, țară, oraș, online, nume</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-dark-500 mb-1">Nume</label>
            <input
              type="text"
              placeholder="Caută după nume..."
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              className="w-40 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlineOnly}
              onChange={(e) => setFilters((f) => ({ ...f, onlineOnly: e.target.checked }))}
              className="rounded border-dark-600 bg-dark-700 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-dark-400">Doar online</span>
          </label>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Gen</label>
            <select
              value={filters.gender}
              onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
              className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Toate</option>
              <option value="male">Bărbat</option>
              <option value="female">Femeie</option>
              <option value="other">Altul</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Vârstă min</label>
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
              className="w-20 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Vârstă max</label>
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
              className="w-20 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Distanță max (km)</label>
            <input
              type="number"
              min={0}
              placeholder="100"
              value={filters.maxDistanceKm}
              onChange={(e) => setFilters((f) => ({ ...f, maxDistanceKm: e.target.value }))}
              className="w-24 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Țară</label>
            <input
              type="text"
              placeholder="ex. România"
              value={filters.country}
              onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
              className="w-36 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Oraș</label>
            <input
              type="text"
              placeholder="ex. București"
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              className="w-36 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {hasItems ? (
        <>
          {currentItem.type === "profile" && current && (
            <>
              <div
                ref={cardRef}
                className="w-full max-w-sm touch-none select-none"
                style={{ touchAction: "none" }}
                onMouseDown={onSwipeStart}
                onMouseMove={onSwipeMove}
                onMouseUp={onSwipeEnd}
                onMouseLeave={onSwipeEnd}
                onTouchStart={onSwipeStart}
                onTouchMove={onSwipeMove}
                onTouchEnd={onSwipeEnd}
              >
                <div
                  className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 relative card-hover will-change-transform"
                  style={{
                    transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.06}deg)`,
                    transition: isDragging ? "none" : "transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)",
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
                      {dragOffset > 0 ? "Like" : "Nope"}
                    </span>
                  </div>
                )}
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
                <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
                  <h3 className="text-2xl font-bold text-white mb-1">{displayName(current.username ?? current.name)}</h3>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {current.friendStatus === "accepted" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#4DA6FF]/30 text-[#4DA6FF] border border-[#4DA6FF]/50">
                        Prieteni
                      </span>
                    )}
                    {current.friendStatus === "pending_sent" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#A0A0A0]/30 text-[#A0A0A0] border border-[#A0A0A0]/50">
                        Cerere trimisă
                      </span>
                    )}
                    {current.friendStatus === "pending_received" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#C77DFF]/30 text-[#C77DFF] border border-[#C77DFF]/50">
                        Vrea să fie prieten
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mb-1">
                    {current.age != null && <span>{current.age} ani</span>}
                    {current.age != null && (current.gender || current.height || current.weight || current.bodyType || current.eyeColor || current.hairColor || current.city) && " · "}
                    {current.gender === "male" && "Bărbat"}
                    {current.gender === "female" && "Femeie"}
                    {current.gender === "other" && "Altul"}
                    {current.height != null && ` · ${current.height} cm`}
                    {current.weight != null && ` · ${current.weight} kg`}
                    {current.bodyType && ` · ${current.bodyType}`}
                    {current.eyeColor && ` · ochi ${current.eyeColor}`}
                    {current.hairColor && ` · păr ${current.hairColor}`}
                    {current.city && ` · ${current.city}`}
                    {current.distanceHidden && " · Distanță ascunsă"}
                    {!current.distanceHidden && current.distanceKm != null && ` · ${getDistanceDisplay(current)}`}
                  </p>
                  <p className="text-gray-300 text-sm line-clamp-3 mb-2">{current.bio || "Fără descriere."}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
                    {current.visitedByThem && <span className="text-[#9D4EDD]">A vizitat profilul tău</span>}
                    {current.messageSeen && <span className="text-[#4DABF7]">A văzut mesajul tău</span>}
                    {current.online && <span className="text-green-400">Este online</span>}
                    {!current.online && current.lastActivityAt != null && (
                      <span>{formatLastActive(current.lastActivityAt)}</span>
                    )}
                  </div>
                  <div className="mb-2">
                    <AddFriendButton
                      userId={current.id}
                      friendStatus={current.friendStatus ?? null}
                      onStatusChange={refreshCurrentUser}
                      variant="big"
                    />
                  </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => onButtonSwipe(false)}
                    className="w-14 h-14 rounded-full bg-dark-600 hover:bg-red-500/25 active:scale-90 flex items-center justify-center text-red-400 border-2 border-red-500/50 transition-[transform,background-color] duration-75 touch-none"
                  >
                    <X className="w-7 h-7" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onButtonSwipe(true)}
                    className="w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-400 active:scale-90 flex items-center justify-center text-dark-900 border-2 border-brand-400/50 transition-[transform,background-color] duration-75 touch-none"
                  >
                    <Heart className="w-7 h-7" />
                  </button>
                </div>
                </div>
              </div>
            </>
          )}

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
                      alt={currentItem.data.alt || "Reclamă"}
                      fill
                      sizes="384px"
                      className="w-full h-full object-contain"
                    />
                  </a>
                ) : (
                  <span className="text-dark-500 text-sm">Reclamă</span>
                )}
              </div>
              <div className="p-3 border-t border-dark-600 flex justify-end">
                <button
                  onClick={advanceToNext}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition"
                >
                  Mai departe <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {currentItem.type === "external_ad" && (
            <div className="w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 relative flex flex-col">
              <div className="flex-1 min-h-[200px] flex items-center justify-center p-4">
                {consent?.marketing ? (
                  <AdSlot variant="strip" hideIfPremium={true} requireMarketingConsent={true} />
                ) : (
                  <p className="text-dark-500 text-xs text-center">Activează reclamele în setările de cookies.</p>
                )}
              </div>
              <div className="p-3 border-t border-dark-600 flex justify-end">
                <button
                  onClick={advanceToNext}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition"
                >
                  Mai departe <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <p className="text-dark-500 text-sm mt-4">
            {profilesRemaining} profiluri rămase
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center w-full">
          {!retriedAfterEmpty ? (
            <>
              <p className="text-dark-500 max-w-sm mb-4">
                Nu s-au găsit profiluri. Schimbă filtrele mai sus sau apasă «Caută din nou».
              </p>
              <button
                onClick={searchAgain}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                Caută din nou
              </button>
            </>
          ) : (
            <>
              <p className="text-dark-500 max-w-sm mb-4">
                Nu mai sunt profiluri care să corespundă filtrelor. Schimbă filtrele (vârstă, gen, oraș) sau revino mai târziu.
              </p>
              <button
                onClick={searchAgain}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                Caută din nou
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
}
