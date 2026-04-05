"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Trash2, MessageCircle, Users, Clock, UserPlus, Eye, MessageSquare, CheckCheck, Heart, ShieldOff, Flag, Circle, Sparkles, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { useSearchFilters, type SearchFilters } from "@/lib/useSearchFilters";
import { DiebelAppPromoCarousel } from "@/components/diebel/DiebelAppPromoCarousel";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { AddFriendButton } from "@/components/AddFriendButton";
import { getSmallCardState, FRIEND_CARD_COLORS } from "@/lib/friendCardStates";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";
import { MAX_PROFILE_SEARCH_RADIUS_KM } from "@/lib/profileSearchConstants";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";

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
  if (f.country.trim()) p.set("country", f.country.trim());
  if (f.city.trim()) p.set("city", f.city.trim());
  if (f.onlineOnly) p.set("onlineOnly", "true");
  if (f.name.trim()) p.set("name", f.name.trim());
  if (f.sortBy) p.set("sortBy", f.sortBy);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export default function ProfilesPage() {
  const { tStr } = useI18n();
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
  const [profiles, setProfiles] = useState<ProfileWithOnline[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLocationEnabled, setMyLocationEnabled] = useState(false);
  const [filters, setFilters] = useSearchFilters();

  const enableLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch("/api/me/location", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            location_enabled: true,
          }),
        }).then((r) => {
          if (r.ok) {
            setMyLocationEnabled(true);
            const raw = getStoredUserRaw();
            if (raw) {
              try {
                const u = JSON.parse(raw) as User;
                const next = { ...u, location_enabled: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                if (typeof localStorage !== "undefined") localStorage.setItem("align_user", JSON.stringify(next));
                if (typeof sessionStorage !== "undefined") sessionStorage.setItem("align_user", JSON.stringify(next));
              } catch {}
            }
          }
          fetch(`/api/profiles${buildQuery(filters)}`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((d) => { if (d.profiles) setProfiles(d.profiles); if (d.myLocationEnabled != null) setMyLocationEnabled(d.myLocationEnabled); });
        });
      },
      () => {}
    );
  };

  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw ? (() => { try { return JSON.parse(meRaw); } catch { return null; } })() : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/profiles${buildQuery(filters)}`, { headers: getAuthHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return { profiles: [], myLocationEnabled: false };
        return { profiles: data.profiles ?? [], myLocationEnabled: data.myLocationEnabled ?? false };
      })
      .then(({ profiles: list, myLocationEnabled: enabled }) => {
        if (cancelled) return;
        setProfiles(list);
        setMyLocationEnabled(enabled);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy]);

  useEffect(() => {
    if (profiles.length === 0) return;
    const t = setInterval(() => {
      fetch(`/api/profiles${buildQuery(filters)}`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((d) => {
          if (d.profiles) setProfiles(d.profiles);
          if (d.myLocationEnabled != null) setMyLocationEnabled(d.myLocationEnabled);
        });
    }, 10000);
    return () => clearInterval(t);
  }, [profiles.length, filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy]);

  useEffect(() => {
    const onConversationRead = () => {
      fetch(`/api/profiles${buildQuery(filters)}`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((d) => { if (d.profiles) setProfiles(d.profiles); });
    };
    window.addEventListener("align:conversation-read", onConversationRead);
    return () => window.removeEventListener("align:conversation-read", onConversationRead);
  }, [filters.gender, filters.minAge, filters.maxAge, filters.maxDistanceKm, filters.country, filters.city, filters.onlineOnly, filters.name, filters.sortBy]);

  const handleDelete = async (userId: string) => {
    await fetch("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ toId: userId, liked: false }),
    });
    setProfiles((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleBlock = async (userId: string) => {
    if (!confirm(tStr("pages.profiles.blockConfirm"))) return;
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ targetUserId: userId }),
    });
    if (res.ok) setProfiles((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleReport = async (userId: string) => {
    const reason = window.prompt(tStr("pages.profiles.reportPrompt"));
    if (reason === null) return;
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        targetUserId: userId,
        reason: reason || tStr("pages.profiles.reportReasonDefault"),
      }),
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{tStr("pages.profiles.title")}</h2>

      {!myLocationEnabled && (
        <div className="mb-4 p-4 rounded-xl bg-dark-800 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-dark-200">{tStr("pages.profiles.enableLocationHint")}</p>
          <button
            type="button"
            onClick={enableLocation}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
          >
            {tStr("pages.profiles.enableLocationBtn")}
          </button>
        </div>
      )}

      <div className="mb-6 p-4 rounded-xl bg-dark-800 border border-dark-600">
        <p className="text-sm text-dark-400 mb-3">{tStr("pages.profiles.filterHint")}</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.nameLabel")}</label>
            <input
              type="text"
              placeholder={tStr("pages.discover.searchPlaceholder")}
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              className="w-40 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
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
          <div className="w-full max-w-xs">
            <label className="block text-xs text-dark-500 mb-1">
              {tStr("pages.profiles.maxDistLabel")}{" "}
              {(Number(filters.maxDistanceKm) || 0) <= 0
                ? "—"
                : `${Math.min(MAX_PROFILE_SEARCH_RADIUS_KM, Number(filters.maxDistanceKm) || 0)} km`}
            </label>
            <input
              type="range"
              min={0}
              max={MAX_PROFILE_SEARCH_RADIUS_KM}
              step={MAX_PROFILE_SEARCH_RADIUS_KM > 250 ? 5 : 1}
              value={Math.min(
                MAX_PROFILE_SEARCH_RADIUS_KM,
                Math.max(0, Number(filters.maxDistanceKm) || 0)
              )}
              onChange={(e) => setFilters((f) => ({ ...f, maxDistanceKm: e.target.value }))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-dark-600 accent-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.profiles.sortLabel")}</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
              className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">{tStr("pages.profiles.sortDefault")}</option>
              <option value="distance">{tStr("pages.profiles.sortDistance")}</option>
              <option value="trust">{tStr("pages.profiles.sortTrust")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">{tStr("pages.discover.countryLabel")}</label>
            <input
              type="text"
              placeholder={tStr("pages.discover.countryPlaceholder")}
              value={filters.country}
              onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
              className="w-28 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
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

      <DiebelAppPromoCarousel />
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

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-dark-500">{tStr("pages.profiles.loading")}</span>
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-center py-10 text-dark-500">{tStr("pages.profiles.empty")}</p>
      ) : (
        <>
      {previewMe && me && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">{tStr("pages.profiles.previewTitle")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-md">
            <div className="border rounded-2xl overflow-hidden flex flex-col bg-dark-800 border-dark-600">
              <div className="w-full h-32 bg-dark-700 overflow-hidden">
                <SilhouetteAvatar
                  photoUrl={me.photos?.[0]}
                  gender={me.gender}
                  name={me.name}
                  shape="rectangle"
                  className="w-full h-32"
                  imgClassName="w-full h-32 object-cover"
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
            className={`rounded-2xl overflow-hidden card-hover flex flex-col ${!border ? "bg-dark-800 border border-dark-600" : "border"}`}
            style={borderStyle}
          >
            <Link
              href={`/app/user/${u.id}`}
              className="block flex-1 min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900 rounded-t-2xl group"
              aria-label={formatTpl(tStr("pages.profiles.viewProfileAria"), {
                name: displayName(u.username ?? u.name),
              })}
            >
              <div
                className={`w-full h-32 bg-dark-700 overflow-hidden transition-[filter] group-hover:brightness-110 ${
                  statusKey === "notVisited" ? "brightness-[0.9] saturate-[0.95]" : ""
                }`}
              >
                <SilhouetteAvatar
                  photoUrl={u.photos?.[0]}
                  gender={u.gender}
                  name={u.name}
                  shape="rectangle"
                  className="w-full h-32"
                  imgClassName="w-full h-32 object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 p-4">
                <p className="font-semibold text-zinc-900 truncate group-hover:text-brand-600 transition-colors">{displayName(u.username ?? u.name)}</p>
                {statusLabel && (
                  <p className="text-xs mt-0.5 flex items-center gap-1 font-medium" style={{ color: stateColor || border || undefined }}>
                    {IconComp && (
                      <span className="shrink-0" style={{ color: stateColor || border || undefined }}>
                        <IconComp className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {statusLabel}
                  </p>
                )}
                {u.bio?.trim() && (
                  <p className="text-sm text-dark-500 mt-1 line-clamp-2">
                    {u.bio.trim()}
                  </p>
                )}
                <p className="text-xs text-dark-400 mt-1 flex flex-wrap gap-x-2 gap-y-0">
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
                  {u.height != null && <span>{u.height} cm</span>}
                  {u.eyeColor && (
                    <span>{formatTpl(tStr("pages.discover.eyePrefix"), { v: u.eyeColor })}</span>
                  )}
                  {u.hairColor && (
                    <span>{formatTpl(tStr("pages.discover.hairPrefix"), { v: u.hairColor })}</span>
                  )}
                  {u.city && <span>{u.city}</span>}
                  <span title={tStr("pages.profiles.distanceTitle")}>{getDistanceDisplay(u)}</span>
                </p>
              </div>
            </Link>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 pt-3 border-t border-dark-600">
              <div className="flex items-center gap-2 shrink-0">
                <AddFriendButton
                  userId={u.id}
                  friendStatus={u.friendStatus ?? null}
                  onStatusChange={() => {
                    fetch(`/api/profiles${buildQuery(filters)}`, { headers: getAuthHeaders() })
                      .then(async (res) => res.ok && (await res.json()).profiles)
                      .then((list) => list && setProfiles(list));
                  }}
                  variant="small"
                />
                <span
                  className="text-xs"
                  style={{ color: u.online ? PROFILE_STATE_COLORS.online : PROFILE_STATE_COLORS.notVisited }}
                  title={u.online ? tStr("pages.messages.online") : tStr("pages.messages.offline")}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: u.online ? PROFILE_STATE_COLORS.online : PROFILE_STATE_COLORS.notVisited }}
                  />
                  {u.online ? tStr("pages.messages.online") : tStr("pages.messages.offline")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <QuickCallButtons toUserId={u.id} size="sm" />
                <button
                  onClick={() => handleDelete(u.id)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
                  title={tStr("pages.profiles.deleteFromList")}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <Link
                  href={`/app/chat/${u.id}`}
                  className="p-2 rounded-lg text-brand-400 hover:bg-brand-500/20 transition"
                  title={tStr("pages.profiles.sendMessageTitle")}
                >
                  <MessageCircle className="w-5 h-5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleBlock(u.id)}
                  className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/20 transition"
                  title={tStr("pages.profiles.blockUserTitle")}
                >
                  <ShieldOff className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReport(u.id)}
                  className="p-2 rounded-lg text-dark-400 hover:bg-dark-600 transition"
                  title={tStr("pages.profiles.reportTitle")}
                >
                  <Flag className="w-5 h-5" />
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
