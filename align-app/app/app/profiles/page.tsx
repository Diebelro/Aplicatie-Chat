"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, MessageCircle, Video, Phone, Users, Clock, UserPlus, Eye, ArrowUpFromLine, MessageSquare, CheckCheck, Heart, ShieldOff, Flag, Circle, Sparkles, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getVideoRoomId } from "@/lib/videoCall";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { useSearchFilters, type SearchFilters } from "@/lib/useSearchFilters";
import { DiebelAppPromoCarousel } from "@/components/diebel/DiebelAppPromoCarousel";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { AddFriendButton } from "@/components/AddFriendButton";
import { getSmallCardState, SMALL_CARD_STATUS_LABELS, FRIEND_CARD_COLORS } from "@/lib/friendCardStates";

/** Culori pentru cele 3 stări pe profil – fără suprapuneri, un singur state per card. */
const PROFILE_STATE_COLORS = {
  online: FRIEND_CARD_COLORS.online,      // #51CF66
  isNew: FRIEND_CARD_COLORS.isNew,        // #339AF0
  notVisited: FRIEND_CARD_COLORS.notVisited, // #868E96
} as const;
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";

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
  messageSent: ArrowUpFromLine,
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

function getDistanceDisplay(u: ProfileWithOnline): string {
  if (u.distanceHidden || u.distanceKm == null) return "Distanță ascunsă";
  const isFriend = u.friendStatus === "accepted";
  if (isFriend && u.distanceKm < 1) return "În apropiere";
  return formatDistance(u.distanceKm);
}

function buildQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.gender) p.set("gender", f.gender);
  if (f.minAge) p.set("minAge", f.minAge);
  if (f.maxAge) p.set("maxAge", f.maxAge);
  if (f.maxDistanceKm) p.set("maxDistanceKm", f.maxDistanceKm);
  if (f.country.trim()) p.set("country", f.country.trim());
  if (f.city.trim()) p.set("city", f.city.trim());
  if (f.onlineOnly) p.set("onlineOnly", "true");
  if (f.name.trim()) p.set("name", f.name.trim());
  if (f.sortBy) p.set("sortBy", f.sortBy);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export default function ProfilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewMe = searchParams.get("preview") === "me";
  const [profiles, setProfiles] = useState<ProfileWithOnline[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLocationEnabled, setMyLocationEnabled] = useState(false);
  const [filters, setFilters] = useSearchFilters();
  const [callingId, setCallingId] = useState<string | null>(null);

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
    if (!confirm("Blochezi acest utilizator? Nu veți mai putea trimite mesaje.")) return;
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ targetUserId: userId }),
    });
    if (res.ok) setProfiles((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleReport = async (userId: string) => {
    const reason = window.prompt("Motivul raportului (opțional):");
    if (reason === null) return;
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ targetUserId: userId, reason: reason || "Raport din listă profiluri" }),
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Toate profilurile</h2>

      {!myLocationEnabled && (
        <div className="mb-4 p-4 rounded-xl bg-dark-800 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-dark-200">Activează locația pentru rezultate mai bune.</p>
          <button
            type="button"
            onClick={enableLocation}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition"
          >
            Activează locația
          </button>
        </div>
      )}

      <div className="mb-6 p-4 rounded-xl bg-dark-800 border border-dark-600">
        <p className="text-sm text-dark-400 mb-3">Filtrează după gen, vârstă, distanță, locație, online, nume</p>
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
          <div className="w-full max-w-xs">
            <label className="block text-xs text-dark-500 mb-1">Distanță max: {filters.maxDistanceKm || "100"} km</label>
            <input
              type="range"
              min={0}
              max={100}
              value={filters.maxDistanceKm === "" ? 100 : Math.min(100, Math.max(0, Number(filters.maxDistanceKm) || 0))}
              onChange={(e) => setFilters((f) => ({ ...f, maxDistanceKm: e.target.value }))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-dark-600 accent-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Sortare</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
              className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Implicit</option>
              <option value="distance">Distanță</option>
              <option value="trust">Trust</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-dark-500 mb-1">Țară</label>
            <input
              type="text"
              placeholder="ex. România"
              value={filters.country}
              onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
              className="w-28 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
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

      <DiebelAppPromoCarousel />
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-dark-500">
        {(
          [
            { key: "friends", label: "Prieteni", color: FRIEND_CARD_COLORS.friends },
            { key: "pendingSent", label: "Cerere trimisă", color: FRIEND_CARD_COLORS.pendingSent },
            { key: "pendingReceived", label: "Cerere primită", color: FRIEND_CARD_COLORS.pendingReceived },
            { key: "match", label: "Match", color: FRIEND_CARD_COLORS.match },
            { key: "messageSeen", label: "Mesaj văzut", color: FRIEND_CARD_COLORS.messageSeen },
            { key: "messageReceived", label: "Mesaj primit", color: FRIEND_CARD_COLORS.messageReceived },
            { key: "messageSent", label: "Mesaj trimis", color: FRIEND_CARD_COLORS.messageSent },
            { key: "visitedYou", label: "A vizitat profilul tău", color: FRIEND_CARD_COLORS.visitedYou },
            { key: "visitedByYou", label: "Vizitat de tine", color: FRIEND_CARD_COLORS.visitedByYou },
            { key: "online", label: "Online", color: FRIEND_CARD_COLORS.online },
            { key: "isNew", label: "Cont nou", color: FRIEND_CARD_COLORS.isNew },
            { key: "notVisited", label: "Profil nedeschis", color: FRIEND_CARD_COLORS.notVisited },
          ] as const
        ).map(({ key, label, color }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border shrink-0" style={{ borderColor: `${color}80`, backgroundColor: `${color}1A` }} />
            {label}
          </span>
        ))}
        <span>Distanța (m/km) apare dacă ai permis locația.</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-dark-500">Se încarcă profilurile...</span>
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-center py-10 text-dark-500">Nu există alte profiluri.</p>
      ) : (
        <>
      {previewMe && me && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Profilul tău (așa te văd alții)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-md">
            <div className="border rounded-2xl overflow-hidden flex flex-col bg-dark-800 border-dark-600">
              <div className="w-full h-32 bg-dark-700 overflow-hidden">
                <SilhouetteAvatar
                  photoUrl={me.photos?.[0]}
                  gender={me.gender}
                  name={me.name}
                  className="w-full h-32"
                  imgClassName="w-full h-32 object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 p-4">
                <p className="font-semibold text-white truncate">{displayName(me.username ?? me.name)}</p>
                <p className="text-xs mt-0.5 text-brand-400">Tu</p>
                {me.bio?.trim() && (
                  <p className="text-sm text-dark-500 mt-1 line-clamp-2">{me.bio.trim()}</p>
                )}
                <p className="text-xs text-dark-400 mt-1 flex flex-wrap gap-x-2 gap-y-0">
                  {me.age != null && <span>{me.age} ani</span>}
                  {me.gender && <span>{me.gender === "male" ? "Bărbat" : me.gender === "female" ? "Femeie" : "Altul"}</span>}
                  {me.height != null && <span>{me.height} cm</span>}
                  {me.eyeColor && <span>ochi {me.eyeColor}</span>}
                  {me.hairColor && <span>păr {me.hairColor}</span>}
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
            sentMessage: u.sentMessage,
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
          const statusLabel = SMALL_CARD_STATUS_LABELS[statusKey];
          return (
          <div
            key={u.id}
            className={`rounded-2xl overflow-hidden card-hover flex flex-col ${!border ? "bg-dark-800 border border-dark-600" : "border"}`}
            style={borderStyle}
          >
            <div className="w-full h-32 bg-dark-700 overflow-hidden">
              <SilhouetteAvatar
                photoUrl={u.photos?.[0]}
                gender={u.gender}
                name={u.name}
                className="w-full h-32"
                imgClassName="w-full h-32 object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 p-4">
              <p className="font-semibold text-white truncate">{displayName(u.username ?? u.name)}</p>
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
                {u.age != null && <span>{u.age} ani</span>}
                {u.gender && <span>{u.gender === "male" ? "Bărbat" : u.gender === "female" ? "Femeie" : "Altul"}</span>}
                {u.height != null && <span>{u.height} cm</span>}
                {u.eyeColor && <span>ochi {u.eyeColor}</span>}
                {u.hairColor && <span>păr {u.hairColor}</span>}
                {u.city && <span>{u.city}</span>}
                <span title="Distanță față de tine">{getDistanceDisplay(u)}</span>
              </p>
            </div>
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
                  title={u.online ? "Online" : "Offline"}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: u.online ? PROFILE_STATE_COLORS.online : PROFILE_STATE_COLORS.notVisited }}
                  />
                  {u.online ? "Online" : "Offline"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startCall(u.id, false)}
                  disabled={!!callingId}
                  className="p-2 rounded-lg text-brand-400 hover:bg-brand-500/20 transition disabled:opacity-50"
                  title="Apel video"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => startCall(u.id, true)}
                  disabled={!!callingId}
                  className="p-2 rounded-lg text-dark-400 hover:bg-dark-600 transition disabled:opacity-50"
                  title="Apel audio"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
                  title="Șterge din listă"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <Link
                  href={`/app/chat/${u.id}`}
                  className="p-2 rounded-lg text-brand-400 hover:bg-brand-500/20 transition"
                  title="Trimite mesaj"
                >
                  <MessageCircle className="w-5 h-5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleBlock(u.id)}
                  className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/20 transition"
                  title="Blochează utilizatorul"
                >
                  <ShieldOff className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReport(u.id)}
                  className="p-2 rounded-lg text-dark-400 hover:bg-dark-600 transition"
                  title="Raportează"
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
