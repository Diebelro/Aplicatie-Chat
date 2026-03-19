import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsersExcept,
  getDislikedUserIds,
  seedFakeProfiles,
  setUserActive,
  isUserOnlineVisible,
  hasVisited,
  hasBeenVisitedBy,
  hasSentMessageTo,
  hasReceivedMessageFrom,
  getFriendStatus,
  getOtherHasReadMyMessage,
  isMutualMatch,
  getDistanceKm,
  getDistanceKmForDisplay,
  getUserPrivacySettings,
  filterUsers,
  findUserById,
  getTrustScore,
  type Gender,
} from "@/lib/store";
import {
  isPrismaAvailable,
  prismaGetFeedCandidates,
  prismaGetMyLocation,
  prismaGetMutualMatchPartnerIds,
  prismaGetMessageFlagsForProfiles,
  prismaGetVisitFlagsForProfiles,
  type FeedFilters,
} from "@/lib/repo-prisma";

function parseFilters(searchParams: URLSearchParams): {
  gender?: Gender | "";
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  country?: string;
  city?: string;
  onlineOnly?: boolean;
  name?: string;
} {
  const gender = searchParams.get("gender") ?? "";
  const minAge = searchParams.get("minAge");
  const maxAge = searchParams.get("maxAge");
  const maxDistanceKm = searchParams.get("maxDistanceKm");
  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const onlineOnly = searchParams.get("onlineOnly") === "true" || searchParams.get("onlineOnly") === "1";
  const name = searchParams.get("name") ?? "";
  const minAgeNum = minAge != null && minAge !== "" ? Number(minAge) : NaN;
  const maxAgeNum = maxAge != null && maxAge !== "" ? Number(maxAge) : NaN;
  const minAgeOk = !Number.isNaN(minAgeNum) && minAgeNum >= 1 && minAgeNum <= 100;
  const maxAgeOk = !Number.isNaN(maxAgeNum) && maxAgeNum >= 1 && maxAgeNum <= 100;
  let finalMin = minAgeOk ? minAgeNum : undefined;
  let finalMax = maxAgeOk ? maxAgeNum : undefined;
  if (finalMin != null && finalMax != null && finalMin > finalMax) finalMax = finalMin;

  return {
    ...(gender && { gender: gender as Gender | "" }),
    ...(finalMin != null && { minAge: finalMin }),
    ...(finalMax != null && { maxAge: finalMax }),
    ...(maxDistanceKm != null && maxDistanceKm !== "" && { maxDistanceKm: Number(maxDistanceKm) }),
    ...(country.trim() && { country: country.trim() }),
    ...(city.trim() && { city: city.trim() }),
    ...(onlineOnly && { onlineOnly: true }),
    ...(name.trim() && { name: name.trim() }),
  };
}

const ONLINE_MS = 60 * 1000;
const NEW_PROFILE_MS = 7 * 24 * 60 * 60 * 1000; // 7 zile

function distanceHaversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

export async function GET(request: NextRequest) {
  seedFakeProfiles();
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  setUserActive(userId);

  if (isPrismaAvailable()) {
    try {
      const filters: FeedFilters = parseFilters(request.nextUrl.searchParams);
      const candidates = await prismaGetFeedCandidates(userId, filters, { includeSwiped: true });
      const myLoc = await prismaGetMyLocation(userId);
      const matchPartnerIds = await prismaGetMutualMatchPartnerIds(userId);
      const sortBy = request.nextUrl.searchParams.get("sortBy") ?? "";
      let sorted = [...candidates];
      if (sortBy === "distance" && myLoc) {
        sorted = sorted.sort((a, b) => {
          const la = a.latitude != null && a.longitude != null ? distanceHaversine(myLoc!.lat, myLoc!.lng, a.latitude, a.longitude) : null;
          const lb = b.latitude != null && b.longitude != null ? distanceHaversine(myLoc!.lat, myLoc!.lng, b.latitude, b.longitude) : null;
          if (la == null && lb == null) return 0;
          if (la == null) return 1;
          if (lb == null) return -1;
          return la - lb;
        });
      }
      const otherIds = sorted.map((u) => u.id);
      const [messageFlags, visitFlags] = await Promise.all([
        prismaGetMessageFlagsForProfiles(userId, otherIds),
        prismaGetVisitFlagsForProfiles(userId, otherIds),
      ]);
      const profilesWithOnline = sorted.map((u) => {
        const hasLocation = u.latitude != null && u.longitude != null;
        const showDistance = u.show_distance !== false && hasLocation;
        const distanceKm =
          myLoc && hasLocation && showDistance
            ? distanceHaversine(myLoc.lat, myLoc.lng, u.latitude!, u.longitude!)
            : null;
        const lastActive = u.last_active ?? null;
        const online = lastActive != null && Date.now() - lastActive < ONLINE_MS;
        const createdAt = (u as { createdAt?: string }).createdAt;
        const isNew = createdAt ? Date.now() - new Date(createdAt).getTime() < NEW_PROFILE_MS : false;
        return {
          ...u,
          trustScore: 0,
          online,
          isNew,
          distanceKm: distanceKm != null ? distanceKm : undefined,
          distanceHidden: distanceKm === null,
          visited: visitFlags.visited.has(u.id),
          visitedByThem: u.show_profile_visits !== false && visitFlags.visitedByThem.has(u.id),
          sentMessage: messageFlags.sentMessage.has(u.id),
          receivedMessage: messageFlags.receivedMessage.has(u.id),
          messageSeen: messageFlags.messageSeen.has(u.id),
          friendStatus: undefined,
          match: matchPartnerIds.has(u.id),
        };
      });
      if (sortBy !== "distance") {
        profilesWithOnline.sort((a, b) => {
          const hasMessages = (u: typeof a) => u.sentMessage || u.receivedMessage || u.messageSeen;
          const tier = (u: typeof a) => {
            if (u.isNew) return 0;
            if (hasMessages(u)) return 1;
            if (u.online) return 2;
            return 3;
          };
          const ta = tier(a);
          const tb = tier(b);
          if (ta !== tb) return ta - tb;
          const lastA = a.last_active ?? 0;
          const lastB = b.last_active ?? 0;
          return lastB - lastA;
        });
      }
      return NextResponse.json({
        profiles: profilesWithOnline,
        myLocationEnabled: !!myLoc,
      });
    } catch (err) {
      console.error("[api/profiles]", err);
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }

  const all = getAllUsersExcept(userId);
  const dislikedIds = getDislikedUserIds(userId);
  const allExceptDisliked = all.filter((u) => !dislikedIds.has(u.id));
  const filters = parseFilters(request.nextUrl.searchParams);
  const sortBy = request.nextUrl.searchParams.get("sortBy") ?? "";
  let filtered = filterUsers(allExceptDisliked, userId, filters);
  if (sortBy === "distance") {
    filtered = [...filtered].sort((a, b) => {
      const da = getDistanceKm(userId, a.id);
      const db = getDistanceKm(userId, b.id);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  } else if (sortBy === "trust") {
    filtered = [...filtered].sort((a, b) => getTrustScore(b) - getTrustScore(a));
  }
  const me = findUserById(userId);
  const profilesWithOnline = filtered.map((u) => {
    const distanceKm = getDistanceKmForDisplay(userId, u.id);
    const theirPrivacy = getUserPrivacySettings(u.id);
    const visitedByThem = theirPrivacy.allowVisitVisibility && hasBeenVisitedBy(userId, u.id);
    const isNew = u.createdAt ? Date.now() - new Date(u.createdAt).getTime() < NEW_PROFILE_MS : false;
    return {
      ...u,
      trustScore: getTrustScore(u),
      online: isUserOnlineVisible(u.id),
      isNew,
      distanceKm: distanceKm != null ? distanceKm : undefined,
      distanceHidden: distanceKm === null,
      visited: hasVisited(userId, u.id),
      visitedByThem,
      sentMessage: hasSentMessageTo(userId, u.id),
      receivedMessage: hasReceivedMessageFrom(userId, u.id),
      messageSeen: getOtherHasReadMyMessage(userId, u.id),
      friendStatus: getFriendStatus(userId, u.id),
      match: isMutualMatch(userId, u.id),
    };
  });
  if (sortBy !== "distance" && sortBy !== "trust") {
    profilesWithOnline.sort((a, b) => {
      const hasMessages = (u: typeof a) => u.sentMessage || u.receivedMessage || u.messageSeen;
      const tier = (u: typeof a) => {
        if (u.isNew) return 0;
        if (hasMessages(u)) return 1;
        if (u.online) return 2;
        return 3;
      };
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      const lastA = a.last_active ?? 0;
      const lastB = b.last_active ?? 0;
      return lastB - lastA;
    });
  }
  return NextResponse.json({
    profiles: profilesWithOnline,
    myLocationEnabled: me?.location_enabled ?? false,
  });
}
