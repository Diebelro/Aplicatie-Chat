import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsersExcept,
  getDislikedUserIds,
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
  getSwipeStatus,
  getMessagesBetween,
  type Gender,
} from "@/lib/store";
import { getInternalAdsForCountry } from "@/lib/internalAds";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  isPrismaAvailable,
  isTestMode,
  prismaGetFeedCandidates,
  prismaGetFeedTestModeMeta,
  prismaGetMutualMatchPartnerIds,
  prismaGetMyLocation,
  prismaUpdateLastActive,
  prismaIsPremium,
  prismaFindUserById,
  prismaLogRateLimit,
  type FeedFilters,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { parseMaxDistanceKmQuery } from "@/lib/profileSearchConstants";

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
  const maxDistanceKmParam = searchParams.get("maxDistanceKm");
  const country = searchParams.get("country") ?? "";
  const city = searchParams.get("city") ?? "";
  const onlineOnly = searchParams.get("onlineOnly") === "true" || searchParams.get("onlineOnly") === "1";
  const name = searchParams.get("name") ?? "";
  const minAgeNum = minAge != null && minAge !== "" ? Number(minAge) : NaN;
  const maxAgeNum = maxAge != null && maxAge !== "" ? Number(maxAge) : NaN;
  const minAgeOk = !Number.isNaN(minAgeNum) && minAgeNum >= 18 && minAgeNum <= 100;
  const maxAgeOk = !Number.isNaN(maxAgeNum) && maxAgeNum >= 18 && maxAgeNum <= 100;
  let finalMin = minAgeOk ? minAgeNum : undefined;
  let finalMax = maxAgeOk ? maxAgeNum : undefined;
  if (finalMin != null && finalMax != null && finalMin > finalMax) finalMax = finalMin;

  const maxDist = parseMaxDistanceKmQuery(maxDistanceKmParam);

  return {
    ...(gender && { gender: gender as Gender | "" }),
    ...(finalMin != null && { minAge: finalMin }),
    ...(finalMax != null && { maxAge: finalMax }),
    ...(maxDist !== undefined && { maxDistanceKm: maxDist }),
    ...(country.trim() && { country: country.trim() }),
    ...(city.trim() && { city: city.trim() }),
    ...(onlineOnly && { onlineOnly: true }),
    ...(name.trim() && { name: name.trim() }),
  };
}

const ONLINE_MS = 60 * 1000; // sub 1 min = instant ca WhatsApp

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
  const userId = await resolveRequestUserId(request);
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
      const candidates = await prismaGetFeedCandidates(userId, filters, { includeSwiped: true });
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

      let profiles = sorted.map((u) => {
        const hasLocation = u.latitude != null && u.longitude != null;
        const showDistance = u.show_distance !== false && hasLocation;
        const distanceKm =
          myLoc && hasLocation && showDistance
            ? distanceHaversine(myLoc.lat, myLoc.lng, u.latitude!, u.longitude!)
            : null;
        const lastActive = u.last_active ?? null;
        const online = lastActive != null && Date.now() - lastActive < ONLINE_MS;
        const createdAt = (u as { createdAt?: string }).createdAt;
        const NEW_PROFILE_MS = 7 * 24 * 60 * 60 * 1000;
        const isNew = createdAt ? Date.now() - new Date(createdAt).getTime() < NEW_PROFILE_MS : false;
        return {
          ...u,
          online,
          isNew,
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

      if (isTestMode()) {
        const meta = await prismaGetFeedTestModeMeta(userId, profiles.map((p) => p.id));
        profiles = profiles.map((p) => {
          const m = meta.get(p.id) ?? {
            hasLiked: false,
            hasDisliked: false,
            isMatched: false,
            hasMessages: false,
          };
          return {
            ...p,
            hasLiked: m.hasLiked,
            hasDisliked: m.hasDisliked,
            isMatched: m.isMatched,
            hasMessages: m.hasMessages,
          };
        });
      }

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

  const filters = parseFilters(request.nextUrl.searchParams);
  const all = getAllUsersExcept(userId);
  const dislikedIds = getDislikedUserIds(userId);
  const toFilter = all.filter((u) => !dislikedIds.has(u.id));
  let filtered = filterUsers(toFilter, userId, filters);
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

  let profiles = filtered.map((u) => {
    const distanceKm = getDistanceKmForDisplay(userId, u.id);
    const theirPrivacy = getUserPrivacySettings(u.id);
    const visitedByThem = theirPrivacy.allowVisitVisibility && hasBeenVisitedBy(userId, u.id);
    const swipe = getSwipeStatus(userId, u.id);
    const hasMessages = getMessagesBetween(userId, u.id).length > 0;
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
      ...(isTestMode()
        ? {
            hasLiked: swipe.hasLiked,
            hasDisliked: swipe.hasDisliked,
            isMatched: isMutualMatch(userId, u.id),
            hasMessages,
          }
        : {}),
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
