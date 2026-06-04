import { NextRequest } from "next/server";
import { apiJsonResponse } from "@/lib/apiNoStore";
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
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { parseDiscoverSearchFilters } from "@/lib/discoverSearchParams";
import { normalizeProfileSortBy, sortProfileCandidates } from "@/lib/profileSort";

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
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return apiJsonResponse({ error: "Neautorizat." }, { status: 401 });
  }
  setUserActive(userId);

  if (isPrismaAvailable()) {
    try {
      const filters: FeedFilters = parseDiscoverSearchFilters(request.nextUrl.searchParams);
      const candidates = await prismaGetFeedCandidates(userId, filters, { includeSwiped: true });
      const myLoc = await prismaGetMyLocation(userId);
      const matchPartnerIds = await prismaGetMutualMatchPartnerIds(userId);
      const sortKey = normalizeProfileSortBy(request.nextUrl.searchParams.get("sortBy"));
      const sorted = sortProfileCandidates(candidates, sortKey, {
        myLoc: myLoc ? { lat: myLoc.lat, lng: myLoc.lng } : null,
      });
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
        const onlineVisible = u.show_online !== false;
        const online =
          onlineVisible && lastActive != null && Date.now() - lastActive < ONLINE_MS;
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
      return apiJsonResponse({
        profiles: profilesWithOnline,
        myLocationEnabled: !!myLoc,
      });
    } catch (err) {
      console.error("[api/profiles]", err);
      return apiJsonResponse({ error: "Eroare server." }, { status: 500 });
    }
  }

  const all = getAllUsersExcept(userId);
  const dislikedIds = getDislikedUserIds(userId);
  const allExceptDisliked = all.filter((u) => !dislikedIds.has(u.id));
  const filters = parseDiscoverSearchFilters(request.nextUrl.searchParams);
  const sortKey = normalizeProfileSortBy(request.nextUrl.searchParams.get("sortBy"));
  let filtered = filterUsers(allExceptDisliked, userId, filters);
  filtered = sortProfileCandidates(filtered, sortKey, {
    myLoc: null,
    viewerDistanceKm: (u) => getDistanceKm(userId, u.id),
  });
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
  return apiJsonResponse({
    profiles: profilesWithOnline,
    myLocationEnabled: me?.location_enabled ?? false,
  });
}
