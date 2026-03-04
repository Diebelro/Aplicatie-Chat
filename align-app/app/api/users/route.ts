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
  type Gender,
} from "@/lib/store";

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

export async function GET(request: NextRequest) {
  seedFakeProfiles();
  const userId = request.headers.get("x-user-id");
  if (userId) setUserActive(userId);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
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
