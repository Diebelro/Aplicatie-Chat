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
  type Gender,
} from "@/lib/store";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { parseMaxDistanceKmQuery } from "@/lib/profileSearchConstants";
import { normalizeProfileSortBy, sortProfileCandidates } from "@/lib/profileSort";

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
  const minAgeOk = !Number.isNaN(minAgeNum) && minAgeNum >= 1 && minAgeNum <= 100;
  const maxAgeOk = !Number.isNaN(maxAgeNum) && maxAgeNum >= 1 && maxAgeNum <= 100;
  let finalMin = minAgeOk ? minAgeNum : undefined;
  let finalMax = maxAgeOk ? maxAgeNum : undefined;
  if (finalMin != null && finalMax != null && finalMin > finalMax) finalMax = finalMin;

  const maxDist = parseMaxDistanceKmQuery(maxDistanceKmParam);
  const maxDistActive = maxDist !== undefined && maxDist > 0 ? maxDist : undefined;

  return {
    ...(gender && { gender: gender as Gender | "" }),
    ...(finalMin != null && { minAge: finalMin }),
    ...(finalMax != null && { maxAge: finalMax }),
    ...(maxDistActive != null && { maxDistanceKm: maxDistActive }),
    ...(country.trim() && { country: country.trim() }),
    ...(city.trim() && { city: city.trim() }),
    ...(onlineOnly && { onlineOnly: true }),
    ...(name.trim() && { name: name.trim() }),
  };
}

export async function GET(request: NextRequest) {
  seedFakeProfiles();
  const userId = await resolveRequestUserId(request);
  if (userId) setUserActive(userId);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const all = getAllUsersExcept(userId);
  const notSwiped = all.filter((u) => !hasSwiped(userId, u.id));
  const filters = parseFilters(request.nextUrl.searchParams);
  let filtered = filterUsers(notSwiped, userId, filters);
  const sortKey = normalizeProfileSortBy(request.nextUrl.searchParams.get("sortBy"));
  filtered = sortProfileCandidates(filtered, sortKey, {
    myLoc: null,
    viewerDistanceKm: (u) => getDistanceKm(userId, u.id),
  });
  const me = findUserById(userId);
  const usersWithMeta = filtered.map((u) => {
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
    users: usersWithMeta,
    myLocationEnabled: me?.location_enabled ?? false,
  });
}
