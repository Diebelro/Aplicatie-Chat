import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsersExcept,
  hasSwiped,
  seedFakeProfiles,
  setUserActive,
  filterUsers,
  isUserOnlineVisible,
  getDistanceKmForDisplay,
  getDistanceKm,
  getTrustScore,
  hasVisited,
  hasBeenVisitedBy,
  hasSentMessageTo,
  hasReceivedMessageFrom,
  getFriendStatus,
  getOtherHasReadMyMessage,
  isMutualMatch,
  getLastActivityAt,
  getUserPrivacySettings,
  findUserById,
  isPremium,
  type Gender,
} from "@/lib/store";
import { getInternalAdsForCountry } from "@/lib/internalAds";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  isPrismaAvailable,
  prismaGetFeedCandidates,
  prismaGetMutualMatchPartnerIds,
  prismaGetMyLocation,
  prismaUpdateLastActive,
  prismaIsPremium,
  prismaFindUserById,
  prismaLogRateLimit,
  type FeedFilters,
} from "@/lib/repo-prisma";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

const MIN_CARDS_BEFORE_ADS = 5;
const INTERNAL_AD_INTERVAL_MIN = 10;
const INTERNAL_AD_INTERVAL_MAX = 14;
const EXTERNAL_AD_INTERVAL_MIN = 18;
const EXTERNAL_AD_INTERVAL_MAX = 25;

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

const ONLINE_MS = 15 * 60 * 1000;

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
  const userId = request.headers.get("x-user-id")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const ip = getClientIp(request);
  const pathname = "/api/feed";
  if (!checkRateLimit(ip, userId, pathname)) {
    if (isPrismaAvailable()) {
      try {
        await prismaLogRateLimit({
          identifier: userId || ip,
          endpoint: pathname,
          count: 1,
          windowStart: new Date(Date.now() - 60 * 1000),
        });
      } catch {}
    }
    return NextResponse.json(
      { error: "Prea multe cereri. Încearcă mai târziu." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  if (userId) setUserActive(userId);

  if (isPrismaAvailable()) {
    try {
      await prismaUpdateLastActive(userId);
      const filters: FeedFilters = parseFilters(request.nextUrl.searchParams);
      const candidates = await prismaGetFeedCandidates(userId, filters);
      const me = await prismaFindUserById(userId);
      const myLoc = await prismaGetMyLocation(userId);
      const matchPartnerIds = await prismaGetMutualMatchPartnerIds(userId);
      const premium = me ? await prismaIsPremium(userId) : false;
      const internalAds = getInternalAdsForCountry(me?.country ?? undefined);

      let sorted = [...candidates];
      const sortBy = request.nextUrl.searchParams.get("sortBy") ?? "";
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

      const profiles = sorted.map((u) => {
        const hasLocation = u.latitude != null && u.longitude != null;
        const showDistance = u.show_distance !== false && hasLocation;
        const distanceKm =
          myLoc && hasLocation && showDistance
            ? distanceHaversine(myLoc.lat, myLoc.lng, u.latitude!, u.longitude!)
            : null;
        const lastActive = u.last_active ?? null;
        const online = lastActive != null && Date.now() - lastActive < ONLINE_MS;
        return {
          ...u,
          online,
          distanceKm: distanceKm != null ? distanceKm : undefined,
          distanceHidden: distanceKm === null,
          lastActivityAt: lastActive ?? undefined,
          visited: false,
          visitedByThem: false,
          sentMessage: false,
          receivedMessage: false,
          messageSeen: false,
          friendStatus: undefined,
          match: matchPartnerIds.has(u.id),
        };
      });

      return NextResponse.json({
        profiles,
        internalAds,
        isPremium: premium,
        minCardsBeforeAds: MIN_CARDS_BEFORE_ADS,
        internalAdIntervalMin: INTERNAL_AD_INTERVAL_MIN,
        internalAdIntervalMax: INTERNAL_AD_INTERVAL_MAX,
        externalAdIntervalMin: EXTERNAL_AD_INTERVAL_MIN,
        externalAdIntervalMax: EXTERNAL_AD_INTERVAL_MAX,
        myLocationEnabled: !!myLoc,
      });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }

  const all = getAllUsersExcept(userId);
  const notSwiped = all.filter((u) => !hasSwiped(userId, u.id));
  const filters = parseFilters(request.nextUrl.searchParams);
  let filtered = filterUsers(notSwiped, userId, filters);
  const sortBy = request.nextUrl.searchParams.get("sortBy") ?? "";
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
  const premium = me ? isPremium(me) : false;
  const internalAds = getInternalAdsForCountry(me?.country ?? undefined);

  const profiles = filtered.map((u) => {
    const distanceKm = getDistanceKmForDisplay(userId, u.id);
    const theirPrivacy = getUserPrivacySettings(u.id);
    const visitedByThem = theirPrivacy.allowVisitVisibility && hasBeenVisitedBy(userId, u.id);
    return {
      ...u,
      online: isUserOnlineVisible(u.id),
      distanceKm: distanceKm != null ? distanceKm : undefined,
      distanceHidden: distanceKm === null,
      lastActivityAt: getLastActivityAt(u.id),
      visited: hasVisited(userId, u.id),
      visitedByThem,
      sentMessage: hasSentMessageTo(userId, u.id),
      receivedMessage: hasReceivedMessageFrom(userId, u.id),
      messageSeen: getOtherHasReadMyMessage(userId, u.id),
      friendStatus: getFriendStatus(userId, u.id),
      match: isMutualMatch(userId, u.id),
    };
  });

  return NextResponse.json({
    profiles,
    internalAds,
    isPremium: premium,
    minCardsBeforeAds: MIN_CARDS_BEFORE_ADS,
    internalAdIntervalMin: INTERNAL_AD_INTERVAL_MIN,
    internalAdIntervalMax: INTERNAL_AD_INTERVAL_MAX,
    externalAdIntervalMin: EXTERNAL_AD_INTERVAL_MIN,
    externalAdIntervalMax: EXTERNAL_AD_INTERVAL_MAX,
    myLocationEnabled: me?.location_enabled ?? false,
  });
}
