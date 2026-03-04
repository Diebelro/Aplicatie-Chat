/**
 * Strat de date enterprise: Prisma + PostgreSQL.
 * Returnează DTO-uri în forma așteptată de frontend (User, Match, Message).
 */

import { prisma } from "@/lib/db";
import type { User, Match, Message } from "@/lib/store";
import type { Gender } from "@/lib/store";

function profileToUserDTO(
  p: {
    id: string;
    userId: string;
    name: string;
    username: string;
    realName: string | null;
    bio: string;
    birthDate: string | null;
    gender: string | null;
    country: string | null;
    city: string | null;
    postalCode: string | null;
    educationLevel: string | null;
    occupation: string | null;
    maritalStatus: string | null;
    wantsChildren: string | null;
    height: number | null;
    weight: number | null;
    eyeColor: string | null;
    hairColor: string | null;
    bodyType: string | null;
    clothingStyle: string | null;
    distinctiveFeatures: string | null;
    partnerPhysicalPreferences: string | null;
    partnerLifestyle: string | null;
    partnerDealBreakers: string | null;
    showDistance: boolean;
    showOnline: boolean;
    showProfileVisits: boolean;
    showReadReceipts: boolean;
    allowFriendRequests: boolean;
    completedAt: Date | null;
    lastActiveAt: Date | null;
    createdAt: Date;
    user: { id: string; email: string; createdAt: Date; role?: string; isBanned?: boolean };
    photos: { url: string; order: number }[];
    userLoc?: { latitude: number; longitude: number } | null;
  }
): User {
  const birthDate = p.birthDate ?? undefined;
  const age = birthDate
    ? Math.floor(
        (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : undefined;
  const photos = p.photos.sort((a, b) => a.order - b.order).map((ph) => ph.url);
  return {
    id: p.userId,
    name: p.name || p.username,
    username: p.username,
    real_name: p.realName ?? null,
    email: p.user.email,
    bio: p.bio,
    age,
    gender: (p.gender as Gender) ?? undefined,
    birthDate: birthDate ?? undefined,
    country: p.country ?? null,
    city: p.city ?? undefined,
    latitude: p.userLoc?.latitude ?? null,
    longitude: p.userLoc?.longitude ?? null,
    location_enabled: !!p.userLoc,
    show_distance: p.showDistance,
    show_online: p.showOnline,
    show_profile_visits: p.showProfileVisits,
    show_read_receipts: p.showReadReceipts,
    allow_friend_requests: p.allowFriendRequests,
    last_active: p.lastActiveAt ? p.lastActiveAt.getTime() : null,
    postalCode: p.postalCode ?? undefined,
    educationLevel: p.educationLevel ?? undefined,
    occupation: p.occupation ?? undefined,
    maritalStatus: p.maritalStatus ?? undefined,
    wantsChildren: p.wantsChildren ?? undefined,
    height: p.height ?? undefined,
    weight: p.weight ?? undefined,
    eyeColor: p.eyeColor ?? undefined,
    hairColor: p.hairColor ?? undefined,
    bodyType: p.bodyType ?? undefined,
    clothingStyle: p.clothingStyle ?? undefined,
    distinctiveFeatures: p.distinctiveFeatures ?? undefined,
    partnerPhysicalPreferences: p.partnerPhysicalPreferences ?? undefined,
    partnerLifestyle: p.partnerLifestyle ?? undefined,
    partnerDealBreakers: p.partnerDealBreakers ?? undefined,
    photos,
    createdAt: p.user.createdAt.toISOString(),
    premium_permanent: false,
    premium_until: null,
    rewarded_activations_today: 0,
    rewarded_activations_date: new Date().toISOString().slice(0, 10),
    subscription_plan_id: null,
    subscription_status: null,
    subscription_current_period_end: null,
    trust_score: null,
    role: p.user.role ?? "USER",
    isBanned: p.user.isBanned ?? false,
  };
}

export async function prismaFindUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      profile: { include: { photos: true } },
      locations: true,
    },
  });
  if (!user?.profile) return null;
  const loc = user.locations[0];
  return profileToUserDTO({
    ...user.profile,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role, isBanned: user.isBanned },
    photos: user.profile.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

export async function prismaFindUserByUsername(username: string): Promise<User | null> {
  const profile = await prisma.profile.findUnique({
    where: { username: username.trim().toLowerCase() },
    include: { user: true, photos: true },
  });
  if (!profile) return null;
  const loc = await prisma.location.findUnique({ where: { userId: profile.userId } });
  return profileToUserDTO({
    ...profile,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: { id: profile.user.id, email: profile.user.email, createdAt: profile.user.createdAt, role: profile.user.role, isBanned: profile.user.isBanned },
    photos: profile.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

export async function prismaFindUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: { include: { photos: true } }, locations: true },
  });
  if (!user?.profile) return null;
  const loc = user.locations[0];
  return profileToUserDTO({
    ...user.profile,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role, isBanned: user.isBanned },
    photos: user.profile.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

export async function prismaCreateUserWithProfile(data: {
  email: string;
  passwordHash: string;
  username: string;
  name?: string;
  birthDate?: string;
  gender?: string;
}): Promise<User> {
  const username = data.username.trim().toLowerCase();
  const email = data.email.trim().toLowerCase();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: data.passwordHash,
      profile: {
        create: {
          name: data.name || username,
          username,
          birthDate: data.birthDate ?? null,
          gender: data.gender ?? null,
        },
      },
    },
    include: { profile: { include: { photos: true } }, locations: true },
  });
  const loc = user.locations[0];
  return profileToUserDTO({
    ...user.profile!,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role, isBanned: user.isBanned },
    photos: user.profile!.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

export async function prismaGetPasswordHash(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return u?.passwordHash ?? null;
}

export async function prismaUpdatePassword(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function prismaUpdateUserEmail(userId: string, email: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { email: email.trim().toLowerCase() },
  });
}

export async function prismaProfileCompleted(userId: string): Promise<boolean> {
  const p = await prisma.profile.findUnique({
    where: { userId },
    select: { completedAt: true },
  });
  return !!p?.completedAt;
}

export async function prismaSetProfileCompleted(userId: string): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: { completedAt: new Date() },
  });
}

export async function prismaHasSwiped(fromId: string, toId: string): Promise<boolean> {
  const s = await prisma.swipe.findUnique({
    where: { fromUserId_toUserId: { fromUserId: fromId, toUserId: toId } },
  });
  return !!s;
}

export async function prismaAddSwipe(fromId: string, toId: string, liked: boolean): Promise<void> {
  await prisma.swipe.upsert({
    where: { fromUserId_toUserId: { fromUserId: fromId, toUserId: toId } },
    create: { fromUserId: fromId, toUserId: toId, liked },
    update: { liked },
  });
}

export async function prismaIsMutualMatch(a: string, b: string): Promise<boolean> {
  const [likeAB, likeBA] = await Promise.all([
    prisma.swipe.findUnique({
      where: { fromUserId_toUserId: { fromUserId: a, toUserId: b } },
      select: { liked: true },
    }),
    prisma.swipe.findUnique({
      where: { fromUserId_toUserId: { fromUserId: b, toUserId: a } },
      select: { liked: true },
    }),
  ]);
  return !!likeAB?.liked && !!likeBA?.liked;
}

export async function prismaAddMatch(userAId: string, userBId: string): Promise<void> {
  const [a, b] = [userAId, userBId].sort();
  await prisma.match.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    create: { userAId: a, userBId: b },
    update: {},
  });
}

export type MessageWithStatus = Message & { status?: string };

export async function prismaAddMessage(
  fromId: string,
  toId: string,
  text: string
): Promise<MessageWithStatus> {
  const m = await prisma.message.create({
    data: { fromUserId: fromId, toUserId: toId, text: text.trim(), status: "SENT" },
  });
  return {
    id: m.id,
    fromId: m.fromUserId,
    toId: m.toUserId,
    text: m.text,
    at: m.createdAt.toISOString(),
    status: m.status,
  };
}

export async function prismaGetMessagesBetween(
  userId1: string,
  userId2: string
): Promise<MessageWithStatus[]> {
  const list = await prisma.message.findMany({
    where: {
      OR: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  return list.map((m) => ({
    id: m.id,
    fromId: m.fromUserId,
    toId: m.toUserId,
    text: m.text,
    at: m.createdAt.toISOString(),
    status: m.status,
  }));
}

export async function prismaUpdateMessageStatus(
  messageId: string,
  status: "SENT" | "DELIVERED" | "SEEN"
): Promise<void> {
  const data: { status: string; deliveredAt?: Date; seenAt?: Date } = { status };
  if (status === "DELIVERED") data.deliveredAt = new Date();
  if (status === "SEEN") data.seenAt = new Date();
  await prisma.message.update({
    where: { id: messageId },
    data,
  });
}

export async function prismaUpsertDevice(params: {
  userId: string;
  fingerprint: string;
  userAgent: string;
  ip: string;
  trusted?: boolean;
}): Promise<{ id: string }> {
  const existing = await prisma.deviceFingerprint.findUnique({
    where: {
      userId_fingerprint: { userId: params.userId, fingerprint: params.fingerprint },
    },
  });
  if (existing) {
    await prisma.deviceFingerprint.update({
      where: { id: existing.id },
      data: { trusted: params.trusted ?? existing.trusted, updatedAt: new Date() },
    });
    return { id: existing.id };
  }
  const d = await prisma.deviceFingerprint.create({
    data: {
      userId: params.userId,
      fingerprint: params.fingerprint,
      userAgent: params.userAgent,
      ip: params.ip,
      trusted: params.trusted ?? false,
    },
  });
  return { id: d.id };
}

export async function prismaLogRateLimit(params: {
  identifier: string;
  endpoint: string;
  count: number;
  windowStart: Date;
}): Promise<void> {
  await prisma.rateLimitLog.create({
    data: {
      identifier: params.identifier,
      endpoint: params.endpoint,
      count: params.count,
      windowStart: params.windowStart,
    },
  });
}

export type FeedFilters = {
  gender?: string;
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  country?: string;
  city?: string;
  onlineOnly?: boolean;
  name?: string;
};

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const t = new Date(birthDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000));
}

export async function prismaGetFeedCandidates(
  userId: string,
  filters: FeedFilters
): Promise<User[]> {
  const swipedToIds = await prisma.swipe.findMany({
    where: { fromUserId: userId },
    select: { toUserId: true },
  });
  const excludeIds = new Set(swipedToIds.map((s) => s.toUserId));
  excludeIds.add(userId);
  const blockedIds = await prismaGetBlockedUserIds(userId);
  blockedIds.forEach((id) => excludeIds.add(id));

  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { locations: true },
  });
  const myLat = me?.locations[0]?.latitude;
  const myLng = me?.locations[0]?.longitude;
  const hasMyLocation = myLat != null && myLng != null && Number.isFinite(myLat) && Number.isFinite(myLng);

  const ONLINE_MS = 15 * 60 * 1000;
  const onlineCutoff = new Date(Date.now() - ONLINE_MS);

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { notIn: [...excludeIds] },
      completedAt: { not: null },
    },
    include: {
      user: true,
      photos: true,
    },
  });

  type Row = (typeof profiles)[0] & { userLoc?: { latitude: number; longitude: number } | null };
  const Location = await prisma.location.findMany({
    where: { userId: { in: profiles.map((p) => p.userId) } },
  });
  const locByUser = new Map(Location.map((l) => [l.userId, { latitude: l.latitude, longitude: l.longitude }]));

  let list: Row[] = profiles.map((p) => ({
    ...p,
    userLoc: locByUser.get(p.userId) ?? null,
  }));

  if (filters.gender && filters.gender !== "") {
    const g = filters.gender.toLowerCase();
    list = list.filter((p) => (p.gender ?? "").toLowerCase() === g);
  }
  if (filters.minAge != null) {
    list = list.filter((p) => {
      const age = ageFromBirthDate(p.birthDate);
      return age != null && age >= filters.minAge!;
    });
  }
  if (filters.maxAge != null) {
    list = list.filter((p) => {
      const age = ageFromBirthDate(p.birthDate);
      return age != null && age <= filters.maxAge!;
    });
  }
  if (filters.country && filters.country.trim() !== "") {
    const c = filters.country.trim().toLowerCase();
    list = list.filter((p) => (p.country ?? "").toLowerCase().includes(c));
  }
  if (filters.city && filters.city.trim() !== "") {
    const c = filters.city.trim().toLowerCase();
    list = list.filter((p) => (p.city ?? "").toLowerCase().includes(c));
  }
  if (filters.name && filters.name.trim() !== "") {
    const n = filters.name.trim().toLowerCase();
    list = list.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(n) ||
        (p.username ?? "").toLowerCase().includes(n)
    );
  }
  if (filters.onlineOnly) {
    list = list.filter((p) => p.lastActiveAt != null && p.lastActiveAt >= onlineCutoff);
  }
  if (filters.maxDistanceKm != null && filters.maxDistanceKm > 0 && hasMyLocation) {
    const R = 6371;
    list = list.filter((p) => {
      const loc = locByUser.get(p.userId);
      if (!loc) return false;
      const dLat = ((loc.latitude - myLat!) * Math.PI) / 180;
      const dLng = ((loc.longitude - myLng!) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((myLat! * Math.PI) / 180) *
          Math.cos((loc.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c <= filters.maxDistanceKm!;
    });
  }

  return list.map((p) =>
    profileToUserDTO({
      ...p,
      user: p.user,
      photos: p.photos.map((ph) => ({ url: ph.url, order: ph.order })),
    } as Parameters<typeof profileToUserDTO>[0])
  );
}

export async function prismaHasUserSwiped(userId: string, targetId: string): Promise<boolean> {
  return prismaHasSwiped(userId, targetId);
}

export async function prismaUpsertLocation(userId: string, lat: number, lng: number): Promise<void> {
  await prisma.location.upsert({
    where: { userId },
    create: { userId, latitude: lat, longitude: lng },
    update: { latitude: lat, longitude: lng },
  });
}

export async function prismaDeleteLocation(userId: string): Promise<void> {
  await prisma.location.deleteMany({ where: { userId } });
}

export async function prismaGetMyLocation(userId: string): Promise<{ lat: number; lng: number } | null> {
  const loc = await prisma.location.findUnique({
    where: { userId },
  });
  if (!loc) return null;
  return { lat: loc.latitude, lng: loc.longitude };
}

export async function prismaGetVisibleUsersForMap(
  meId: string
): Promise<{ id: string; name: string; lat: number; lng: number }[]> {
  const profiles = await prisma.profile.findMany({
    where: { userId: { not: meId }, showDistance: true },
    select: { userId: true, name: true },
  });
  const userIds = profiles.map((p) => p.userId);
  const locations = await prisma.location.findMany({
    where: { userId: { in: userIds } },
  });
  const locByUser = new Map(locations.map((l) => [l.userId, l]));
  const ONLINE_MS = 15 * 60 * 1000;
  const cutoff = new Date(Date.now() - ONLINE_MS);
  const withActivity = await prisma.profile.findMany({
    where: { userId: { in: userIds }, lastActiveAt: { gte: cutoff } },
    select: { userId: true },
  });
  const activeSet = new Set(withActivity.map((p) => p.userId));
  return profiles
    .filter((p) => locByUser.has(p.userId) && activeSet.has(p.userId))
    .map((p) => {
      const loc = locByUser.get(p.userId)!;
      return { id: p.userId, name: p.name, lat: loc.latitude, lng: loc.longitude };
    });
}

export async function prismaGetMutualMatchPartnerIds(userId: string): Promise<Set<string>> {
  const matchRows = await prisma.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return new Set(matchRows.map((m) => (m.userAId === userId ? m.userBId : m.userAId)));
}

export async function prismaGetMutualMatches(userId: string): Promise<User[]> {
  const partnerIds = await prismaGetMutualMatchPartnerIds(userId);
  const users: User[] = [];
  for (const id of partnerIds) {
    const u = await prismaFindUserById(id);
    if (u) users.push(u);
  }
  return users;
}

export async function prismaActivatePremiumDemo(
  userId: string,
  planId: string,
  currentPeriodEnd?: Date | null
): Promise<void> {
  const end = currentPeriodEnd ?? (planId === "lifetime" ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const existing = await prisma.premiumSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.premiumSubscription.update({
      where: { id: existing.id },
      data: { planId, status: "active", currentPeriodEnd: end ?? undefined },
    });
  } else {
    await prisma.premiumSubscription.create({
      data: {
        userId,
        planId,
        status: "active",
        currentPeriodEnd: end ?? undefined,
      },
    });
  }
}

export async function prismaUpdateProfile(
  userId: string,
  data: Partial<{
    realName: string | null;
    name: string;
    username: string;
    bio: string;
    birthDate: string | null;
    gender: string | null;
    country: string | null;
    city: string | null;
    postalCode: string | null;
    educationLevel: string | null;
    occupation: string | null;
    maritalStatus: string | null;
    wantsChildren: string | null;
    height: number | null;
    weight: number | null;
    eyeColor: string | null;
    hairColor: string | null;
    bodyType: string | null;
    clothingStyle: string | null;
    distinctiveFeatures: string | null;
    partnerPhysicalPreferences: string | null;
    partnerLifestyle: string | null;
    partnerDealBreakers: string | null;
    showDistance: boolean;
    showOnline: boolean;
    showProfileVisits: boolean;
    showReadReceipts: boolean;
    allowFriendRequests: boolean;
    lastActiveAt: Date;
  }>
): Promise<void> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return;
  const update: Record<string, unknown> = {};
  if (data.realName !== undefined) update.realName = data.realName;
  if (data.name !== undefined) update.name = data.name;
  if (data.username !== undefined) update.username = data.username;
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.birthDate !== undefined) update.birthDate = data.birthDate;
  if (data.gender !== undefined) update.gender = data.gender;
  if (data.country !== undefined) update.country = data.country;
  if (data.city !== undefined) update.city = data.city;
  if (data.postalCode !== undefined) update.postalCode = data.postalCode;
  if (data.educationLevel !== undefined) update.educationLevel = data.educationLevel;
  if (data.occupation !== undefined) update.occupation = data.occupation;
  if (data.maritalStatus !== undefined) update.maritalStatus = data.maritalStatus;
  if (data.wantsChildren !== undefined) update.wantsChildren = data.wantsChildren;
  if (data.height !== undefined) update.height = data.height;
  if (data.weight !== undefined) update.weight = data.weight;
  if (data.eyeColor !== undefined) update.eyeColor = data.eyeColor;
  if (data.hairColor !== undefined) update.hairColor = data.hairColor;
  if (data.bodyType !== undefined) update.bodyType = data.bodyType;
  if (data.clothingStyle !== undefined) update.clothingStyle = data.clothingStyle;
  if (data.distinctiveFeatures !== undefined) update.distinctiveFeatures = data.distinctiveFeatures;
  if (data.partnerPhysicalPreferences !== undefined) update.partnerPhysicalPreferences = data.partnerPhysicalPreferences;
  if (data.partnerLifestyle !== undefined) update.partnerLifestyle = data.partnerLifestyle;
  if (data.partnerDealBreakers !== undefined) update.partnerDealBreakers = data.partnerDealBreakers;
  if (data.showDistance !== undefined) update.showDistance = data.showDistance;
  if (data.showOnline !== undefined) update.showOnline = data.showOnline;
  if (data.showProfileVisits !== undefined) update.showProfileVisits = data.showProfileVisits;
  if (data.showReadReceipts !== undefined) update.showReadReceipts = data.showReadReceipts;
  if (data.allowFriendRequests !== undefined) update.allowFriendRequests = data.allowFriendRequests;
  if (data.lastActiveAt !== undefined) update.lastActiveAt = data.lastActiveAt;
  if (Object.keys(update).length === 0) return;
  await prisma.profile.update({
    where: { userId },
    data: update as Record<string, unknown>,
  });
}

const MAX_PHOTOS = 5;

export async function prismaUpsertProfilePhotos(userId: string, photoUrls: string[]): Promise<void> {
  const urls = photoUrls.slice(0, MAX_PHOTOS).filter((u) => typeof u === "string" && u.length > 0);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return;
  await prisma.profilePhoto.deleteMany({ where: { profileId: profile.id } });
  for (let i = 0; i < urls.length; i++) {
    await prisma.profilePhoto.create({
      data: { profileId: profile.id, url: urls[i], order: i },
    });
  }
}

export async function prismaUpdateLastActive(userId: string): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: { lastActiveAt: new Date() },
  });
}

export async function prismaIsPremium(userId: string): Promise<boolean> {
  const sub = await prisma.premiumSubscription.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) return false;
  return !!sub;
}

export async function prismaGetPremiumSubscription(userId: string): Promise<{
  planId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
} | null> {
  const sub = await prisma.premiumSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) return null;
  const expired = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date();
  return {
    planId: sub.planId,
    status: expired ? "expired" : sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
  };
}

export async function prismaGetUnreadFrom(meId: string, otherId: string): Promise<number> {
  const count = await prisma.message.count({
    where: {
      fromUserId: otherId,
      toUserId: meId,
      seenAt: null,
    },
  });
  return count;
}

export async function prismaMarkConversationAsRead(meId: string, otherId: string): Promise<void> {
  const messages = await prisma.message.findMany({
    where: { fromUserId: otherId, toUserId: meId },
  });
  for (const m of messages) {
    if (m.status !== "SEEN") await prismaUpdateMessageStatus(m.id, "SEEN");
  }
}

export interface ConversationSummaryPrisma {
  otherUser: User;
  lastMessage: { id: string; fromId: string; toId: string; text: string; at: string };
}

export async function prismaGetConversations(userId: string): Promise<ConversationSummaryPrisma[]> {
  const messages = await prisma.message.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    orderBy: { createdAt: "desc" },
  });
  const byOther = new Map<string, { id: string; fromId: string; toId: string; text: string; at: string }>();
  for (const m of messages) {
    const other = m.fromUserId === userId ? m.toUserId : m.fromUserId;
    if (!byOther.has(other)) {
      byOther.set(other, {
        id: m.id,
        fromId: m.fromUserId,
        toId: m.toUserId,
        text: m.text,
        at: m.createdAt.toISOString(),
      });
    }
  }
  const result: ConversationSummaryPrisma[] = [];
  for (const [otherId, lastMessage] of byOther) {
    const otherUser = await prismaFindUserById(otherId);
    if (otherUser) result.push({ otherUser, lastMessage });
  }
  result.sort((a, b) => new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime());
  return result;
}

export async function prismaBlockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

export async function prismaUnblockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.block.deleteMany({
    where: { blockerId, blockedId },
  });
}

export async function prismaIsBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const b = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return !!b;
}

export async function prismaHasBlockBetween(userId1: string, userId2: string): Promise<boolean> {
  const a = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: userId1, blockedId: userId2 } },
  });
  const b = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: userId2, blockedId: userId1 } },
  });
  return !!a || !!b;
}

/** Returns user IDs that are in a block relation with userId (blocked by me or have blocked me). */
export async function prismaGetBlockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
}

export async function prismaReportUser(reporterId: string, reportedId: string, reason: string): Promise<void> {
  await prisma.report.create({
    data: { reporterId, reportedId, reason: reason.trim().slice(0, 2000) },
  });
}

export async function prismaGetReports(): Promise<
  { id: string; reporterId: string; reportedId: string; reason: string; createdAt: Date; reporterEmail?: string; reportedEmail?: string }[]
> {
  const list = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: { reporter: { select: { email: true } }, reported: { select: { email: true } } },
  });
  return list.map((r) => ({
    id: r.id,
    reporterId: r.reporterId,
    reportedId: r.reportedId,
    reason: r.reason,
    createdAt: r.createdAt,
    reporterEmail: r.reporter?.email,
    reportedEmail: r.reported?.email,
  }));
}

export async function prismaGetMatchIdBetween(userAId: string, userBId: string): Promise<string | null> {
  const m = await prisma.match.findFirst({
    where: {
      OR: [
        { userAId, userBId },
        { userAId: userBId, userBId: userAId },
      ],
    },
    select: { id: true },
  });
  return m?.id ?? null;
}

export async function prismaDeleteMatchById(matchId: string): Promise<boolean> {
  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (!m) return false;
  await prisma.match.delete({ where: { id: matchId } });
  return true;
}

export async function prismaDeleteConversation(userId1: string, userId2: string): Promise<void> {
  await prisma.message.deleteMany({
    where: {
      OR: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
    },
  });
}

export async function prismaCreateAdminLog(adminId: string, action: string, targetId?: string | null): Promise<void> {
  await prisma.adminLog.create({
    data: { adminId, action, targetId: targetId ?? undefined },
  });
}

export async function prismaGetUserRole(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return u?.role ?? "USER";
}

export async function prismaHasAnyAdmin(): Promise<boolean> {
  const count = await prisma.user.count({
    where: { role: { in: ["ADMIN", "SUPERADMIN"] } },
  });
  return count > 0;
}

export async function prismaSetUserRole(userId: string, role: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

export async function prismaGetAdminLogs(limit = 200): Promise<
  { id: string; adminId: string; action: string; targetId: string | null; createdAt: Date; adminEmail?: string }[]
> {
  const list = await prisma.adminLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { admin: { select: { email: true } } },
  });
  return list.map((l) => ({
    id: l.id,
    adminId: l.adminId,
    action: l.action,
    targetId: l.targetId,
    createdAt: l.createdAt,
    adminEmail: l.admin?.email,
  }));
}

export async function prismaSetUserBanned(userId: string, banned: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: banned },
  });
}

export type AdminUserRow = { id: string; email: string; role: string; isBanned: boolean; createdAt: Date };

export async function prismaGetUsersForAdmin(search?: string): Promise<AdminUserRow[]> {
  const q = search?.trim();
  const where = q
    ? { OR: [{ id: q }, { email: { contains: q, mode: "insensitive" as const } }] }
    : undefined;
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, role: true, isBanned: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return users;
}

export async function findUserOrPrisma(userId: string): Promise<User | null> {
  if (isPrismaAvailable()) {
    try {
      return await prismaFindUserById(userId);
    } catch {
      return null;
    }
  }
  const { findUserById } = await import("@/lib/store");
  const u = findUserById(userId);
  return u ?? null;
}

export function isPrismaAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}
