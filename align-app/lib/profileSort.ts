import type { User } from "@/lib/store";
import { getTrustScore } from "@/lib/store";

const ONLINE_MS = 60 * 1000;

export type ProfileSortKey = "online" | "recommended" | "distance";

/** Normalizează vechile valori `""` / `trust` și ignoră valorile necunoscute. */
export function normalizeProfileSortBy(raw: string | null | undefined): ProfileSortKey {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "distance") return "distance";
  if (s === "online") return "online";
  return "recommended";
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isOnlineByLastActive(lastActive: number | null | undefined): boolean {
  return lastActive != null && Date.now() - lastActive < ONLINE_MS;
}

/** Cont verificat (e-mail) sau, fără câmp, profil „solid” după scor intern. */
export function isRecommendedVerifiedProfile(u: User): boolean {
  if (u.email_verified === true) return true;
  if (u.email_verified === false) return false;
  return getTrustScore(u) >= 35;
}

export type ProfileSortContext = {
  myLoc: { lat: number; lng: number } | null;
  /** Modul in-memory: distanță față de observator când lipsește lat/lng pe DTO. */
  viewerDistanceKm?: (u: User) => number | null;
};

export function sortProfileCandidates(users: readonly User[], sortKey: ProfileSortKey, ctx: ProfileSortContext): User[] {
  const arr = [...users];

  if (sortKey === "distance") {
    const distKm = (u: User): number | null => {
      if (ctx.viewerDistanceKm) {
        return ctx.viewerDistanceKm(u);
      }
      if (ctx.myLoc != null && u.latitude != null && u.longitude != null) {
        return haversineKm(ctx.myLoc.lat, ctx.myLoc.lng, u.latitude, u.longitude);
      }
      return null;
    };
    arr.sort((a, b) => {
      const da = distKm(a);
      const db = distKm(b);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
    return arr;
  }

  if (sortKey === "online") {
    arr.sort((a, b) => {
      const oa = isOnlineByLastActive(a.last_active ?? null) ? 1 : 0;
      const ob = isOnlineByLastActive(b.last_active ?? null) ? 1 : 0;
      if (oa !== ob) return ob - oa;
      return (b.last_active ?? 0) - (a.last_active ?? 0);
    });
    return arr;
  }

  arr.sort((a, b) => {
    const va = isRecommendedVerifiedProfile(a) ? 1 : 0;
    const vb = isRecommendedVerifiedProfile(b) ? 1 : 0;
    if (va !== vb) return vb - va;
    return (b.last_active ?? 0) - (a.last_active ?? 0);
  });
  return arr;
}
