/**
 * Strat de date enterprise: Prisma + PostgreSQL.
 * Returnează DTO-uri în forma așteptată de frontend (User, Match, Message).
 */

import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeAuthEmail } from "@/lib/auth";
import { logDevPrismaNoticeOnce } from "@/lib/dev-prisma-notice";
import { REJECTED_CALL_ROOM_TTL_MS, RING_PENDING_MAX_MS } from "@/lib/callRingConstants";
import type { User, Match, Message } from "@/lib/store";
import type { Gender } from "@/lib/store";
import { PLATFORM_NOTICE_VISIBLE_DAYS } from "@/lib/platformModerationNotice";
import { cityMatchesFilter, nameMatchesFilter, normalizeStrict } from "@/lib/discoverMatchUtils";
import { displayName } from "@/lib/displayName";

/** Ascunde în chat notificările platformă expirate (rândul poate exista încă în DB). */
export function prismaMessageWhereChatVisible(): Prisma.MessageWhereInput {
  return {
    NOT: {
      AND: [
        { isPlatformNotice: true },
        { platformNoticeExpiresAt: { not: null } },
        { platformNoticeExpiresAt: { lt: new Date() } },
      ],
    },
  };
}

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
    physicalAsset: string | null;
    physicalAssetDetail: string | null;
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
    user: {
      id: string;
      email: string;
      createdAt: Date;
      role?: string;
      isBanned?: boolean;
      banUntil?: Date | null;
      emailVerified?: Date | null;
    };
    photos: { url: string; order: number }[];
    userLoc?: { latitude: number; longitude: number } | null;
  }
): User {
  const until = p.user.banUntil ?? null;
  const accessBlocked = !!(p.user.isBanned || (until && until > new Date()));
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
    physicalAsset: p.physicalAsset ?? undefined,
    physicalAssetDetail: p.physicalAssetDetail ?? undefined,
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
    ...("emailVerified" in p.user
      ? { email_verified: p.user.emailVerified != null }
      : {}),
    role: p.user.role ?? "USER",
    isBanned: accessBlocked,
    banUntil: until ? until.toISOString() : null,
  };
}

/** Șterge suspendarea expirată (reactivar acces fără acțiune manuală). */
export async function prismaClearBanIfExpired(userId: string): Promise<void> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { banUntil: true },
    });
    if (u?.banUntil && u.banUntil.getTime() <= Date.now()) {
      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: false, banUntil: null },
      });
    }
  } catch {
    /* ignore */
  }
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
  await prismaClearBanIfExpired(user.id);
  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isBanned: true, banUntil: true },
  });
  const loc = user.locations[0];
  return profileToUserDTO({
    ...user.profile,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
      isBanned: refreshed?.isBanned ?? user.isBanned,
      banUntil: refreshed?.banUntil ?? user.banUntil,
    },
    photos: user.profile.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

export async function prismaFindUserByUsername(username: string): Promise<User | null> {
  const profile = await prisma.profile.findUnique({
    where: { username: username.trim().toLowerCase() },
    include: { user: true, photos: true },
  });
  if (!profile) return null;
  await prismaClearBanIfExpired(profile.userId);
  const pu = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { id: true, email: true, createdAt: true, role: true, isBanned: true, banUntil: true },
  });
  const loc = await prisma.location.findUnique({ where: { userId: profile.userId } });
  return profileToUserDTO({
    ...profile,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: {
      id: pu!.id,
      email: pu!.email,
      createdAt: pu!.createdAt,
      role: pu!.role,
      isBanned: pu!.isBanned,
      banUntil: pu!.banUntil,
    },
    photos: profile.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

export async function prismaFindUserById(id: string): Promise<User | null> {
  await prismaClearBanIfExpired(id);
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: { include: { photos: true } }, locations: true },
  });
  if (!user?.profile) return null;
  const loc = user.locations[0];
  return profileToUserDTO({
    ...user.profile,
    userLoc: loc ? { latitude: loc.latitude, longitude: loc.longitude } : null,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
      isBanned: user.isBanned,
      banUntil: user.banUntil,
    },
    photos: user.profile.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

/** Găsește user doar după id (pentru /api/me). Dacă are Profile, returnează DTO complet; altfel returnează minim (id, email, photos: []). */
export async function prismaFindUserByIdForMe(userId: string): Promise<User | null> {
  const full = await prismaFindUserById(userId);
  if (full) return full;
  await prismaClearBanIfExpired(userId);
  const row = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { include: { photos: true } } },
  });
  if (!row) return null;
  const profile = row.profile;
  const photos = profile?.photos?.sort((a, b) => a.order - b.order).map((ph) => ph.url) ?? [];
  return {
    id: row.id,
    email: row.email,
    name: profile?.name ?? row.email.split("@")[0],
    username: profile?.username ?? row.email.split("@")[0],
    real_name: profile?.realName ?? null,
    bio: profile?.bio ?? "",
    age: undefined,
    birthDate: profile?.birthDate ?? undefined,
    gender: (profile?.gender as Gender) ?? undefined,
    country: profile?.country ?? null,
    city: profile?.city ?? undefined,
    latitude: null,
    longitude: null,
    location_enabled: false,
    show_distance: true,
    show_online: true,
    show_profile_visits: true,
    show_read_receipts: true,
    allow_friend_requests: true,
    last_active: profile?.lastActiveAt ? profile.lastActiveAt.getTime() : null,
    postalCode: profile?.postalCode ?? undefined,
    educationLevel: profile?.educationLevel ?? undefined,
    occupation: profile?.occupation ?? undefined,
    maritalStatus: profile?.maritalStatus ?? undefined,
    wantsChildren: profile?.wantsChildren ?? undefined,
    height: profile?.height ?? undefined,
    weight: profile?.weight ?? undefined,
    eyeColor: profile?.eyeColor ?? undefined,
    hairColor: profile?.hairColor ?? undefined,
    bodyType: profile?.bodyType ?? undefined,
    clothingStyle: profile?.clothingStyle ?? undefined,
    distinctiveFeatures: profile?.distinctiveFeatures ?? undefined,
    partnerPhysicalPreferences: profile?.partnerPhysicalPreferences ?? undefined,
    partnerLifestyle: profile?.partnerLifestyle ?? undefined,
    partnerDealBreakers: profile?.partnerDealBreakers ?? undefined,
    photos,
    createdAt: row.createdAt.toISOString(),
    premium_permanent: false,
    premium_until: null,
    rewarded_activations_today: 0,
    rewarded_activations_date: new Date().toISOString().slice(0, 10),
    subscription_plan_id: null,
    subscription_status: null,
    subscription_current_period_end: null,
    trust_score: null,
    role: row.role ?? "USER",
    isBanned: !!(row.isBanned || (row.banUntil && row.banUntil > new Date())),
    banUntil: row.banUntil?.toISOString() ?? null,
  };
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
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
      isBanned: user.isBanned,
      banUntil: user.banUntil,
    },
    photos: user.profile!.photos.map((ph) => ({ url: ph.url, order: ph.order })),
  } as Parameters<typeof profileToUserDTO>[0]);
}

/**
 * Login OAuth: găsește user după email sau creează cont fără parolă (passwordHash null), profil minimal.
 */
export async function prismaFindOrCreateOAuthUser(params: {
  email: string;
  name: string | null | undefined;
}): Promise<{ id: string; profileComplete: boolean }> {
  const email = normalizeAuthEmail(params.email);
  if (!email) {
    throw new Error("Email lipsă pentru OAuth.");
  }
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });
  if (existing) {
    if (!existing.profile) {
      const base = email.split("@")[0]?.replace(/[^a-z0-9_]/gi, "") || "user";
      let username = base.slice(0, 24).toLowerCase() || "user";
      let n = 0;
      while (
        await prisma.profile.findUnique({
          where: { username },
        })
      ) {
        username = `${base.slice(0, 16)}${++n}`;
      }
      await prisma.profile.create({
        data: {
          userId: existing.id,
          username,
          name: params.name?.trim() || username,
        },
      });
      return { id: existing.id, profileComplete: false };
    }
    return { id: existing.id, profileComplete: !!existing.profile.completedAt };
  }

  const base = email.split("@")[0]?.replace(/[^a-z0-9_]/gi, "") || "user";
  let username = base.slice(0, 24).toLowerCase() || "user";
  let n = 0;
  while (
    await prisma.profile.findUnique({
      where: { username },
    })
  ) {
    username = `${base.slice(0, 16)}${++n}`;
  }
  const display = (params.name?.trim() || username).slice(0, 120);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: null,
      emailVerified: new Date(),
      profile: {
        create: {
          username,
          name: display,
        },
      },
    },
    include: { profile: true },
  });
  return { id: user.id, profileComplete: !!user.profile?.completedAt };
}

/** Găsește user doar după email (pentru login). Nu cere Profile – astfel conturile existente sunt găsite mereu. */
export async function prismaFindUserByEmailForLogin(
  email: string
): Promise<{ id: string; email: string; isBanned: boolean; role: string } | null> {
  const em = normalizeAuthEmail(email);
  if (!em) return null;

  const select = {
    id: true,
    email: true,
    isBanned: true,
    banUntil: true,
    role: true,
  } as const;

  let user =
    (await prisma.user.findUnique({
      where: { email: em },
      select,
    })) ?? null;

  /** Rânduri vechi cu altă capitalizare / fără NFKC — pe Postgres comparăm insensibil la litere mici-mari. */
  if (!user) {
    user =
      (await prisma.user.findFirst({
        where: { email: { equals: em, mode: "insensitive" } },
        select,
      })) ?? null;
  }

  if (!user) return null;
  await prismaClearBanIfExpired(user.id);
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isBanned: true, banUntil: true },
  });
  const blocked = !!(fresh?.isBanned || (fresh?.banUntil && fresh.banUntil > new Date()));
  return { id: user.id, email: user.email, isBanned: blocked, role: user.role };
}

/**
 * Un singur cont „proprietar” primește automat rol ADMIN dacă emailul coincide cu ADMIN_OWNER_EMAIL sau CONTACT_EMAIL.
 * Nu modifică SUPERADMIN. Pe Vercel setează CONTACT_EMAIL=contact@diebel.ro (sau ADMIN_OWNER_EMAIL) ca să nu mai depinzi de scripturi manuale.
 */
export async function prismaEnsureOwnerAdminRole(userId: string, email: string): Promise<boolean> {
  const ownerRaw = (process.env.ADMIN_OWNER_EMAIL || process.env.CONTACT_EMAIL || "").trim().toLowerCase();
  if (!ownerRaw) return false;
  const em = normalizeAuthEmail(email);
  if (!em || em !== ownerRaw) return false;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!row || row.role === "SUPERADMIN" || row.role === "ADMIN") return false;
  await prisma.user.update({
    where: { id: userId },
    data: { role: "ADMIN" },
  });
  return true;
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

const PASSWORD_RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

function hashPasswordResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Șterge token-uri nefolosite anterioare; creează unul nou. Returnează token-ul brut (doar pentru URL/email). */
export async function prismaCreatePasswordResetToken(userId: string): Promise<{ token: string }> {
  await prisma.passwordResetToken.deleteMany({
    where: { userId, usedAt: null },
  });
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(raw);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return { token: raw };
}

export async function prismaFindValidPasswordResetToken(
  rawToken: string
): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashPasswordResetToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!row || row.usedAt != null) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

/** Marchează token folosit și actualizează parola; returnează null dacă token invalid/expirat. */
const EMAIL_VERIFICATION_TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;

function hashEmailVerificationToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Șterge token-uri vechi pentru user; creează token nou pentru linkul din email. */
export async function prismaCreateEmailVerificationToken(
  userId: string
): Promise<{ token: string }> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashEmailVerificationToken(raw);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY_MS);
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return { token: raw };
}

export async function prismaFindValidEmailVerificationToken(
  rawToken: string
): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashEmailVerificationToken(rawToken);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

export async function prismaCompleteEmailVerification(rawToken: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const tokenHash = hashEmailVerificationToken(rawToken);
    const row = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.expiresAt.getTime() < Date.now()) return false;
    await tx.user.update({
      where: { id: row.userId },
      data: { emailVerified: new Date() },
    });
    await tx.emailVerificationToken.deleteMany({ where: { userId: row.userId } });
    return true;
  });
}

/** Retrimite link de verificare; acceptă și token expirat dacă încă există în DB. */
export async function prismaResendEmailVerification(
  rawToken: string
): Promise<{ token: string; email: string } | null> {
  const tokenHash = hashEmailVerificationToken(rawToken);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });
  if (!row) return null;
  const u = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { email: true, emailVerified: true },
  });
  if (!u || u.emailVerified != null) return null;
  const { token } = await prismaCreateEmailVerificationToken(row.userId);
  return { token, email: u.email };
}

export async function prismaCompletePasswordReset(
  rawToken: string,
  newPasswordHash: string
): Promise<{ userId: string; email: string } | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const tokenHash = hashPasswordResetToken(rawToken);
      const row = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!row || row.usedAt != null || row.expiresAt.getTime() < Date.now()) {
        return null;
      }
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash: newPasswordHash },
      });
      const u = await tx.user.findUnique({
        where: { id: row.userId },
        select: { id: true, email: true },
      });
      if (!u) return null;
      return { userId: u.id, email: u.email };
    });
  } catch {
    return null;
  }
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

/** `null` = niciun swipe încă. */
export async function prismaGetSwipeLiked(fromId: string, toId: string): Promise<boolean | null> {
  const s = await prisma.swipe.findUnique({
    where: { fromUserId_toUserId: { fromUserId: fromId, toUserId: toId } },
    select: { liked: true },
  });
  if (!s) return null;
  return s.liked;
}

export async function prismaDeleteMatchBetween(a: string, b: string): Promise<void> {
  const [x, y] = [a, b].sort();
  await prisma.match.deleteMany({ where: { userAId: x, userBId: y } });
}

export async function prismaMatchRowExistsBetween(a: string, b: string): Promise<boolean> {
  const [x, y] = [a, b].sort();
  const m = await prisma.match.findUnique({
    where: { userAId_userBId: { userAId: x, userBId: y } },
    select: { id: true },
  });
  return !!m;
}

export type SwipeReviewEntry = User & { mySwipeLiked: boolean };

/** Profiluri pe care le-ai swipe-uit (like sau pass), recent actualizate primele — pentru recenzare. */
export async function prismaListSwipedProfilesForReview(
  userId: string,
  limit = 100
): Promise<SwipeReviewEntry[]> {
  const blocked = await prismaGetBlockedUserIds(userId);
  const excludeIds = [...blocked, userId];
  const swipes = await prisma.swipe.findMany({
    where: {
      fromUserId: userId,
      toUserId: { notIn: excludeIds },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { toUserId: true, liked: true },
  });
  const out: SwipeReviewEntry[] = [];
  for (const s of swipes) {
    const u = await prismaFindUserById(s.toUserId);
    if (!u || u.isBanned) continue;
    out.push({ ...u, mySwipeLiked: s.liked });
  }
  return out;
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

export type MessageWithStatus = Message & { status?: string; seenAt?: string; isPlatformNotice?: boolean };

export async function prismaAddMessage(
  fromId: string,
  toId: string,
  text: string,
  attachmentUrl?: string | null,
  attachmentContentType?: string | null
): Promise<MessageWithStatus> {
  const m = await prisma.message.create({
    data: {
      fromUserId: fromId,
      toUserId: toId,
      text: (text ?? "").trim(),
      status: "SENT",
      attachmentUrl: attachmentUrl ?? undefined,
      attachmentContentType: attachmentContentType ?? undefined,
    },
  });
  return {
    id: m.id,
    fromId: m.fromUserId,
    toId: m.toUserId,
    text: m.text,
    at: m.createdAt.toISOString(),
    status: m.status,
    seenAt: m.seenAt?.toISOString() ?? undefined,
    attachmentUrl: m.attachmentUrl ?? undefined,
    attachmentContentType: m.attachmentContentType ?? undefined,
    isPlatformNotice: m.isPlatformNotice ?? false,
  };
}

export async function prismaInsertPlatformNoticeInThread(
  fromUserId: string,
  toUserId: string,
  text: string
): Promise<MessageWithStatus> {
  const platformNoticeExpiresAt = new Date(
    Date.now() + PLATFORM_NOTICE_VISIBLE_DAYS * 24 * 60 * 60 * 1000
  );
  const m = await prisma.message.create({
    data: {
      fromUserId,
      toUserId,
      text: text.trim().slice(0, 8000),
      status: "SENT",
      isPlatformNotice: true,
      platformNoticeExpiresAt,
    },
  });
  return {
    id: m.id,
    fromId: m.fromUserId,
    toId: m.toUserId,
    text: m.text,
    at: m.createdAt.toISOString(),
    status: m.status,
    seenAt: m.seenAt?.toISOString() ?? undefined,
    attachmentUrl: m.attachmentUrl ?? undefined,
    attachmentContentType: m.attachmentContentType ?? undefined,
    isPlatformNotice: true,
  };
}

export async function prismaDeleteAllMessagesBetweenUsers(userId1: string, userId2: string): Promise<number> {
  const r = await prisma.message.deleteMany({
    where: {
      OR: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
    },
  });
  return r.count;
}

export async function prismaGetMessagesBetween(
  userId1: string,
  userId2: string
): Promise<MessageWithStatus[]> {
  const list = await prisma.message.findMany({
    where: {
      AND: [
        {
          OR: [
            { fromUserId: userId1, toUserId: userId2 },
            { fromUserId: userId2, toUserId: userId1 },
          ],
        },
        prismaMessageWhereChatVisible(),
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
    seenAt: m.seenAt?.toISOString() ?? undefined,
    attachmentUrl: m.attachmentUrl ?? undefined,
    attachmentContentType: m.attachmentContentType ?? undefined,
    isPlatformNotice: m.isPlatformNotice ?? false,
  }));
}

export async function prismaGetMessageById(messageId: string): Promise<{
  fromUserId: string;
  toUserId: string;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
} | null> {
  const m = await prisma.message.findUnique({
    where: { id: messageId },
    select: { fromUserId: true, toUserId: true, attachmentUrl: true, attachmentContentType: true },
  });
  return m;
}

/** Ultimele N mesaje între doi utilizatori (ordine cronologică), doar admin / rute interne. */
export async function prismaAdminGetLastMessagesBetween(
  userA: string,
  userB: string,
  take: number
): Promise<
  Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    text: string;
    createdAt: Date;
    attachmentUrl: string | null;
  }>
> {
  const cap = Math.min(80, Math.max(5, take));
  const rows = await prisma.message.findMany({
    where: {
      AND: [
        {
          OR: [
            { fromUserId: userA, toUserId: userB },
            { fromUserId: userB, toUserId: userA },
          ],
        },
        prismaMessageWhereChatVisible(),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: cap,
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      text: true,
      createdAt: true,
      attachmentUrl: true,
    },
  });
  return rows.reverse();
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

/** TEST_MODE: feed nu exclude profilele deja swipe-uite; folosit pentru test cu 20 conturi. */
export function isTestMode(): boolean {
  return process.env.TEST_MODE === "true" || process.env.TEST_MODE === "1";
}

export async function prismaGetFeedCandidates(
  userId: string,
  filters: FeedFilters,
  _options?: { includeSwiped?: boolean }
): Promise<User[]> {
  const swipes = await prisma.swipe.findMany({
    where: { fromUserId: userId },
    select: { toUserId: true, liked: true },
  });
  const excludeIds = new Set<string>();
  excludeIds.add(userId);
  const blockedIds = await prismaGetBlockedUserIds(userId);
  blockedIds.forEach((id) => excludeIds.add(id));
  swipes.filter((s) => !s.liked).forEach((s) => excludeIds.add(s.toUserId));

  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { locations: true },
  });
  const myLat = me?.locations[0]?.latitude;
  const myLng = me?.locations[0]?.longitude;
  const hasMyLocation = myLat != null && myLng != null && Number.isFinite(myLat) && Number.isFinite(myLng);

  const ONLINE_MS = 60 * 1000; // sub 1 min = instant ca WhatsApp
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
      return age == null || age >= filters.minAge!;
    });
  }
  if (filters.maxAge != null) {
    list = list.filter((p) => {
      const age = ageFromBirthDate(p.birthDate);
      return age == null || age <= filters.maxAge!;
    });
  }
  if (filters.country && filters.country.trim() !== "") {
    const want = normalizeStrict(filters.country);
    list = list.filter((p) => {
      const raw = (p.country ?? "").trim();
      // Profil fără țară: rămâne vizibil (altfel filtrul implicit „România” ascunde toți utilizatorii fără țară setată).
      if (!raw) return true;
      return normalizeStrict(p.country ?? "") === want;
    });
  }
  if (filters.city && filters.city.trim() !== "") {
    const fc = filters.city;
    list = list.filter((p) => {
      const raw = (p.city ?? "").trim();
      if (!raw) return true;
      return cityMatchesFilter(p.city, fc);
    });
  }
  if (filters.name && filters.name.trim() !== "") {
    const q = filters.name;
    list = list.filter((p) => nameMatchesFilter(p.name, p.username, q));
  }
  if (filters.onlineOnly) {
    list = list.filter((p) => p.lastActiveAt != null && p.lastActiveAt >= onlineCutoff);
  }
  // Distanța aleasă: doar profiluri cu locație în DB (Haversine față de mine). Fără estimări.
  // Fără locația mea nu putem evalua filtrul → niciun rezultat (nu relaxăm către „toți”).
  // Fără filtru de distanță: profilurile fără locație rămân în listă.
  if (filters.maxDistanceKm != null && filters.maxDistanceKm > 0) {
    if (!hasMyLocation) {
      /* Fără locația mea: ignorăm distanța (altfel feed gol pe mobil unde lipsește GPS). */
    } else {
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

export async function prismaGetMyMapLocation(userId: string): Promise<{
  lat: number;
  lng: number;
  mapVisibleUntil: string | null;
} | null> {
  const loc = await prisma.location.findUnique({ where: { userId } });
  if (!loc) return null;
  return {
    lat: loc.latitude,
    lng: loc.longitude,
    mapVisibleUntil: loc.mapVisibleUntil?.toISOString() ?? null,
  };
}

export async function prismaSetLocationMapVisibility(userId: string, until: Date | null): Promise<{ updated: boolean }> {
  const r = await prisma.location.updateMany({
    where: { userId },
    data: { mapVisibleUntil: until },
  });
  return { updated: r.count > 0 };
}

/** Prima poză profil (medalion pe hartă). */
export async function prismaGetFirstProfilePhotoUrl(userId: string): Promise<string | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      photos: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
    },
  });
  return profile?.photos[0]?.url ?? null;
}

const MAP_USER_ONLINE_MS = 60 * 1000;

export async function prismaGetVisibleUsersForMap(
  meId: string
): Promise<
  { id: string; name: string; username: string; lat: number; lng: number; photoUrl: string | null; online: boolean }[]
> {
  const now = new Date();
  const profiles = await prisma.profile.findMany({
    where: {
      userId: { not: meId },
      showDistance: true,
      completedAt: { not: null },
    },
    select: {
      userId: true,
      name: true,
      username: true,
      showOnline: true,
      lastActiveAt: true,
      photos: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
    },
  });
  const userIds = profiles.map((p) => p.userId);
  if (userIds.length === 0) return [];
  const locations = await prisma.location.findMany({
    where: {
      userId: { in: userIds },
      mapVisibleUntil: { gt: now },
    },
  });
  const locByUser = new Map(locations.map((l) => [l.userId, l]));
  const nowMs = Date.now();
  return profiles
    .filter((p) => locByUser.has(p.userId))
    .map((p) => {
      const loc = locByUser.get(p.userId)!;
      const rawOnline =
        p.lastActiveAt != null && nowMs - p.lastActiveAt.getTime() < MAP_USER_ONLINE_MS;
      const online = p.showOnline ? rawOnline : false;
      return {
        id: p.userId,
        name: p.name,
        username: p.username,
        lat: loc.latitude,
        lng: loc.longitude,
        photoUrl: p.photos[0]?.url ?? null,
        online,
      };
    });
}

export async function prismaGetMutualMatchPartnerIds(userId: string): Promise<Set<string>> {
  const matchRows = await prisma.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return new Set(matchRows.map((m) => (m.userAId === userId ? m.userBId : m.userAId)));
}

export interface FeedTestModeMeta {
  hasLiked: boolean;
  hasDisliked: boolean;
  isMatched: boolean;
  hasMessages: boolean;
}

/** Pentru TEST_MODE: status swipe + match + conversație per profil. */
export async function prismaGetFeedTestModeMeta(
  userId: string,
  profileIds: string[]
): Promise<Map<string, FeedTestModeMeta>> {
  const map = new Map<string, FeedTestModeMeta>();
  if (profileIds.length === 0) return map;
  const [mySwipes, matchPartnerIds, messages] = await Promise.all([
    prisma.swipe.findMany({
      where: { fromUserId: userId, toUserId: { in: profileIds } },
      select: { toUserId: true, liked: true },
    }),
    prismaGetMutualMatchPartnerIds(userId),
    prisma.message.findMany({
      where: {
        AND: [
          {
            OR: [
              { fromUserId: userId, toUserId: { in: profileIds } },
              { fromUserId: { in: profileIds }, toUserId: userId },
            ],
          },
          prismaMessageWhereChatVisible(),
        ],
      },
      select: { fromUserId: true, toUserId: true },
    }),
  ]);
  const messagePartnerIds = new Set<string>();
  for (const m of messages) {
    const other = m.fromUserId === userId ? m.toUserId : m.fromUserId;
    messagePartnerIds.add(other);
  }
  const swipeByTo = new Map(mySwipes.map((s) => [s.toUserId, s.liked]));
  for (const id of profileIds) {
    const liked = swipeByTo.get(id);
    map.set(id, {
      hasLiked: liked === true,
      hasDisliked: liked === false,
      isMatched: matchPartnerIds.has(id),
      hasMessages: messagePartnerIds.has(id),
    });
  }
  return map;
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
    physicalAsset: string | null;
    physicalAssetDetail: string | null;
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
  if (data.physicalAsset !== undefined) update.physicalAsset = data.physicalAsset;
  if (data.physicalAssetDetail !== undefined) update.physicalAssetDetail = data.physicalAssetDetail;
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
const MAX_URL_LENGTH = 2 * 1024 * 1024; // 2MB per URL (limită DB/text)

export async function prismaUpsertProfilePhotos(userId: string, photoUrls: string[]): Promise<void> {
  const urls = photoUrls
    .slice(0, MAX_PHOTOS)
    .filter((u) => typeof u === "string" && u.length > 0 && u.length <= MAX_URL_LENGTH);
  let profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;
    const base = user.email.split("@")[0].replace(/[^a-z0-9]/gi, "") || "user";
    let username = base.toLowerCase().slice(0, 30);
    let n = 0;
    while (await prisma.profile.findUnique({ where: { username } })) {
      username = `${base.slice(0, 26)}${n}`.toLowerCase();
      n++;
    }
    profile = await prisma.profile.create({
      data: { userId, name: username, username },
    });
  }
  await prisma.profilePhoto.deleteMany({ where: { profileId: profile.id } });
  for (let i = 0; i < urls.length; i++) {
    await prisma.profilePhoto.create({
      data: { profileId: profile.id, url: urls[i].slice(0, MAX_URL_LENGTH), order: i },
    });
  }
}

export async function prismaUpdateLastActive(userId: string): Promise<void> {
  await prisma.profile.updateMany({
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
      AND: [
        { fromUserId: otherId, toUserId: meId, seenAt: null },
        prismaMessageWhereChatVisible(),
      ],
    },
  });
  return count;
}

export async function prismaGetTotalUnread(meId: string): Promise<number> {
  const count = await prisma.message.count({
    where: {
      AND: [{ toUserId: meId, seenAt: null }, prismaMessageWhereChatVisible()],
    },
  });
  return count;
}

export async function prismaMarkConversationAsRead(meId: string, otherId: string): Promise<void> {
  await prisma.message.updateMany({
    where: {
      AND: [
        { fromUserId: otherId, toUserId: meId, seenAt: null },
        prismaMessageWhereChatVisible(),
      ],
    },
    data: { status: "SEEN", seenAt: new Date() },
  });
}

/** Pentru listă profiluri: cine are mesaje trimise/primite/citite cu meId (pentru culori/badge-uri). */
export async function prismaGetMessageFlagsForProfiles(
  meId: string,
  otherIds: string[]
): Promise<{ sentMessage: Set<string>; receivedMessage: Set<string>; messageSeen: Set<string> }> {
  const sentMessage = new Set<string>();
  const receivedMessage = new Set<string>();
  const messageSeen = new Set<string>();
  if (otherIds.length === 0) return { sentMessage, receivedMessage, messageSeen };

  const [sent, receivedUnread, seen] = await Promise.all([
    prisma.message.findMany({
      where: {
        AND: [{ fromUserId: meId, toUserId: { in: otherIds } }, prismaMessageWhereChatVisible()],
      },
      select: { toUserId: true },
      distinct: ["toUserId"],
    }),
    prisma.message.findMany({
      where: {
        AND: [
          { fromUserId: { in: otherIds }, toUserId: meId, seenAt: null },
          prismaMessageWhereChatVisible(),
        ],
      },
      select: { fromUserId: true },
      distinct: ["fromUserId"],
    }),
    prisma.message.findMany({
      where: {
        AND: [
          { fromUserId: meId, toUserId: { in: otherIds }, seenAt: { not: null } },
          prismaMessageWhereChatVisible(),
        ],
      },
      select: { toUserId: true },
      distinct: ["toUserId"],
    }),
  ]);
  sent.forEach((r) => sentMessage.add(r.toUserId));
  receivedUnread.forEach((r) => receivedMessage.add(r.fromUserId));
  seen.forEach((r) => messageSeen.add(r.toUserId));
  return { sentMessage, receivedMessage, messageSeen };
}

/** Persistă vizita: eu (viewer) am vizitat profilul lui profileUserId. */
export async function prismaAddVisit(viewerUserId: string, profileUserId: string): Promise<void> {
  const now = new Date();
  await prisma.visit.upsert({
    where: {
      viewerUserId_profileUserId: { viewerUserId, profileUserId },
    },
    create: { viewerUserId, profileUserId, lastVisitedAt: now },
    update: { lastVisitedAt: now },
  });
}

/** Rând pentru lista „Vizite la profil” (doar vizitatori cu reciprocitate la confidențialitate). */
export type ProfileVisitListItem = {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  lastVisitedAt: string;
  firstVisitedAt: string;
  hasMatchOrChat: boolean;
};

/**
 * Lista vizitelor către profilul utilizatorului `visitedUserId`.
 * `listEnabled`: utilizatorul vizitat permite lista; vizitatorii apar doar dacă și ei permit.
 */
export async function prismaListVisibleProfileVisits(
  visitedUserId: string
): Promise<{ listEnabled: boolean; visits: ProfileVisitListItem[] }> {
  const myProfile = await prisma.profile.findUnique({
    where: { userId: visitedUserId },
    select: { showProfileVisits: true },
  });
  if (!myProfile?.showProfileVisits) {
    return { listEnabled: false, visits: [] };
  }
  const blocked = new Set(await prismaGetBlockedUserIds(visitedUserId));
  const blockedArr = blocked.size > 0 ? [...blocked] : [];
  const rows = await prisma.visit.findMany({
    where: {
      profileUserId: visitedUserId,
      ...(blockedArr.length > 0 ? { viewerUserId: { notIn: blockedArr } } : {}),
      viewer: {
        isBanned: false,
        profile: { is: { showProfileVisits: true } },
      },
    },
    orderBy: { lastVisitedAt: "desc" },
    take: 100,
    include: {
      viewer: {
        include: {
          profile: {
            include: {
              photos: { orderBy: { order: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  const visitorIds = rows.map((r) => r.viewerUserId);
  if (visitorIds.length === 0) {
    return { listEnabled: true, visits: [] };
  }
  const [matchRows, messageRows] = await Promise.all([
    prisma.match.findMany({
      where: {
        OR: [
          { userAId: visitedUserId, userBId: { in: visitorIds } },
          { userBId: visitedUserId, userAId: { in: visitorIds } },
        ],
      },
      select: { userAId: true, userBId: true },
    }),
    prisma.message.findMany({
      where: {
        AND: [
          prismaMessageWhereChatVisible(),
          {
            OR: [
              { AND: [{ fromUserId: visitedUserId }, { toUserId: { in: visitorIds } }] },
              { AND: [{ toUserId: visitedUserId }, { fromUserId: { in: visitorIds } }] },
            ],
          },
        ],
      },
      select: { fromUserId: true, toUserId: true },
    }),
  ]);
  const matchSet = new Set<string>();
  for (const m of matchRows) {
    matchSet.add(m.userAId === visitedUserId ? m.userBId : m.userAId);
  }
  const chatSet = new Set<string>();
  for (const m of messageRows) {
    chatSet.add(m.fromUserId === visitedUserId ? m.toUserId : m.fromUserId);
  }
  const visits: ProfileVisitListItem[] = [];
  for (const r of rows) {
    const p = r.viewer.profile;
    if (!p) continue;
    const vid = r.viewerUserId;
    const hasMatchOrChat = matchSet.has(vid) || chatSet.has(vid);
    visits.push({
      userId: vid,
      displayName: displayName(p.username || p.name),
      photoUrl: p.photos[0]?.url ?? null,
      lastVisitedAt: r.lastVisitedAt.toISOString(),
      firstVisitedAt: r.createdAt.toISOString(),
      hasMatchOrChat,
    });
  }
  return { listEnabled: true, visits };
}

/** Pentru listă profiluri: cine am vizitat eu și cine m-a vizitat (pentru culori/badge-uri). */
export async function prismaGetVisitFlagsForProfiles(
  meId: string,
  otherIds: string[]
): Promise<{ visited: Set<string>; visitedByThem: Set<string> }> {
  const visited = new Set<string>();
  const visitedByThem = new Set<string>();
  if (otherIds.length === 0) return { visited, visitedByThem };
  const [asViewer, asProfile] = await Promise.all([
    prisma.visit.findMany({
      where: { viewerUserId: meId, profileUserId: { in: otherIds } },
      select: { profileUserId: true },
    }),
    prisma.visit.findMany({
      where: { viewerUserId: { in: otherIds }, profileUserId: meId },
      select: { viewerUserId: true },
    }),
  ]);
  asViewer.forEach((r) => visited.add(r.profileUserId));
  asProfile.forEach((r) => visitedByThem.add(r.viewerUserId));
  return { visited, visitedByThem };
}

export interface ConversationSummaryPrisma {
  otherUser: User;
  lastMessage: { id: string; fromId: string; toId: string; text: string; at: string; isPlatformNotice?: boolean };
  /** true dacă nu există niciun mesaj încă (doar match). */
  noMessagesYet?: boolean;
}

export async function prismaGetConversations(userId: string): Promise<ConversationSummaryPrisma[]> {
  const messages = await prisma.message.findMany({
    where: {
      AND: [{ OR: [{ fromUserId: userId }, { toUserId: userId }] }, prismaMessageWhereChatVisible()],
    },
    orderBy: { createdAt: "desc" },
  });
  const byOther = new Map<
    string,
    { id: string; fromId: string; toId: string; text: string; at: string; isPlatformNotice?: boolean }
  >();
  for (const m of messages) {
    const other = m.fromUserId === userId ? m.toUserId : m.fromUserId;
    if (!byOther.has(other)) {
      byOther.set(other, {
        id: m.id,
        fromId: m.fromUserId,
        toId: m.toUserId,
        text: m.text,
        at: m.createdAt.toISOString(),
        isPlatformNotice: m.isPlatformNotice ?? false,
      });
    }
  }
  const result: ConversationSummaryPrisma[] = [];
  for (const [otherId, lastMessage] of byOther) {
    const otherUser = await prismaFindUserByIdForMe(otherId);
    if (otherUser) result.push({ otherUser, lastMessage });
  }
  result.sort((a, b) => new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime());
  return result;
}

/** Listă conversații incluzând match-uri fără niciun mesaj (pentru UX: match apare în Mesaje). */
export async function prismaGetConversationsWithMatches(userId: string): Promise<ConversationSummaryPrisma[]> {
  const [withMessages, matchRows] = await Promise.all([
    prismaGetConversations(userId),
    prisma.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true, createdAt: true },
    }),
  ]);
  const existingOtherIds = new Set(withMessages.map((c) => c.otherUser.id));
  const matchPartners: { otherId: string; at: string }[] = matchRows.map((m) => ({
    otherId: m.userAId === userId ? m.userBId : m.userAId,
    at: m.createdAt.toISOString(),
  }));
  const toAdd: ConversationSummaryPrisma[] = [];
  for (const { otherId, at } of matchPartners) {
    if (existingOtherIds.has(otherId)) continue;
    existingOtherIds.add(otherId);
    const otherUser = await prismaFindUserByIdForMe(otherId);
    if (otherUser) {
      toAdd.push({
        otherUser,
        lastMessage: { id: `match-${otherId}`, fromId: otherId, toId: userId, text: "", at, isPlatformNotice: false },
        noMessagesYet: true,
      });
    }
  }
  const combined = [...withMessages, ...toAdd];
  combined.sort((a, b) => new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime());
  return combined;
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

/** Utilizatori pe care i-am blocat eu (blockerId = mine). Pentru listă în UI + deblocare. */
export async function prismaListUsersIBlocked(
  blockerId: string
): Promise<{ id: string; username: string | null; profileName: string | null }[]> {
  const rows = await prisma.block.findMany({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
    select: {
      blockedId: true,
      blocked: {
        select: {
          id: true,
          profile: { select: { username: true, name: true, realName: true } },
        },
      },
    },
  });
  return rows.map((r) => {
    const p = r.blocked.profile;
    const profileName = (p?.realName?.trim() || p?.name?.trim() || "") || null;
    return {
      id: r.blockedId,
      username: p?.username?.trim() || null,
      profileName,
    };
  });
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

export async function prismaCreateAppFeedback(
  userId: string,
  message: string,
  pageUrl: string | null
): Promise<void> {
  await prisma.appFeedback.create({
    data: {
      userId,
      message: message.trim().slice(0, 8000),
      pageUrl: pageUrl ? pageUrl.trim().slice(0, 2000) : null,
    },
  });
}

export async function prismaListAppFeedback(
  limit = 200
): Promise<
  { id: string; userId: string; message: string; pageUrl: string | null; createdAt: Date; userEmail?: string }[]
> {
  const list = await prisma.appFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });
  return list.map((r) => ({
    id: r.id,
    userId: r.userId,
    message: r.message,
    pageUrl: r.pageUrl,
    createdAt: r.createdAt,
    userEmail: r.user?.email,
  }));
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

/** Rapoarte unde acest utilizator este cel raportat (moderare). */
export async function prismaGetReportsForReportedUser(
  reportedId: string,
  limit = 20
): Promise<
  { id: string; reporterId: string; reason: string; createdAt: Date; reporterEmail?: string }[]
> {
  const list = await prisma.report.findMany({
    where: { reportedId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { reporter: { select: { email: true } } },
  });
  return list.map((r) => ({
    id: r.id,
    reporterId: r.reporterId,
    reason: r.reason,
    createdAt: r.createdAt,
    reporterEmail: r.reporter?.email,
  }));
}

/** Ultimul eveniment BAN_USER din log (motiv opțional). Folosit când userul e încă isBanned. */
export async function prismaGetLatestBanLogForUser(userId: string): Promise<{
  details: string | null;
  createdAt: Date;
  adminEmail?: string;
} | null> {
  const log = await prisma.adminLog.findFirst({
    where: { targetId: userId, action: "BAN_USER" },
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { email: true } } },
  });
  if (!log) return null;
  return {
    details: log.details ?? null,
    createdAt: log.createdAt,
    adminEmail: log.admin?.email,
  };
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

export async function prismaCreateAdminLog(
  adminId: string,
  action: string,
  targetId?: string | null,
  details?: string | null
): Promise<void> {
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      targetId: targetId ?? undefined,
      details: details?.trim() ? details.trim().slice(0, 4000) : undefined,
    },
  });
}

export async function prismaCountPendingBanAppeals(): Promise<number> {
  return prisma.banAppeal.count({ where: { status: "PENDING" } });
}

export async function prismaCreateBanAppeal(
  userId: string,
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true, banUntil: true } });
  const blocked = !!(u?.isBanned || (u?.banUntil && u.banUntil > new Date()));
  if (!blocked) return { ok: false, error: "Contul nu este blocat sau nu există." };
  const pending = await prisma.banAppeal.count({ where: { userId, status: "PENDING" } });
  if (pending > 0) return { ok: false, error: "Ai deja o cerere în așteptare. Te rugăm să aștepți răspunsul." };
  const text = message.trim().slice(0, 4000);
  if (text.length < 10) return { ok: false, error: "Scrie cel puțin 10 caractere (explică pe scurt situația)." };
  await prisma.banAppeal.create({ data: { userId, message: text } });
  return { ok: true };
}

export type AdminBanAppealRow = {
  id: string;
  userId: string;
  message: string;
  status: string;
  createdAt: Date;
  userEmail: string;
};

export async function prismaListPendingBanAppealsForAdmin(): Promise<AdminBanAppealRow[]> {
  const list = await prisma.banAppeal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { email: true } } },
  });
  return list.map((a) => ({
    id: a.id,
    userId: a.userId,
    message: a.message,
    status: a.status,
    createdAt: a.createdAt,
    userEmail: a.user.email,
  }));
}

export async function prismaResolveBanAppealAsAdmin(
  appealId: string,
  action: "DISMISS" | "UNBAN",
  adminId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appeal = await prisma.banAppeal.findUnique({ where: { id: appealId } });
  if (!appeal || appeal.status !== "PENDING") {
    return { ok: false, error: "Cererea nu există sau a fost deja procesată." };
  }
  if (action === "UNBAN") {
    await prisma.$transaction([
      prisma.user.update({ where: { id: appeal.userId }, data: { isBanned: false, banUntil: null } }),
      prisma.banAppeal.update({
        where: { id: appealId },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      }),
    ]);
    await prismaCreateAdminLog(
      adminId,
      "UNBAN_USER",
      appeal.userId,
      "Contestație blocare acceptată (BanAppeal " + appealId.slice(0, 8) + ")"
    );
  } else {
    await prisma.banAppeal.update({
      where: { id: appealId },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    await prismaCreateAdminLog(adminId, "DISMISS_BAN_APPEAL", appeal.userId, "Contestație respinsă. " + appealId);
  }
  return { ok: true };
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
  {
    id: string;
    adminId: string;
    action: string;
    targetId: string | null;
    details: string | null;
    createdAt: Date;
    adminEmail?: string;
  }[]
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
    details: l.details ?? null,
    createdAt: l.createdAt,
    adminEmail: l.admin?.email,
  }));
}

export type AdminModerationSummary = {
  totalUsers: number;
  bannedUsers: number;
  totalReports: number;
  signupsLast24Hours: number;
  signupsLast7Days: number;
  signupsLast15Days: number;
  signupsLast30Days: number;
  reportsLast24Hours: number;
  reportsLast7Days: number;
  reportsLast15Days: number;
  reportsLast30Days: number;
  newUsersSince: number;
  newReportsSince: number;
  /** AppFeedback cu createdAt >= since (același checkpoint ca înscrieri/rapoarte). */
  newAppFeedbackSince: number;
};

export type AdminModerationSinceByKind = {
  users: Date;
  reports: Date;
  feedback: Date;
};

/** Rezumat pentru dashboard moderare — `since` per tip (înscrieri / rapoarte / feedback app). */
export async function prismaGetAdminModerationSummary(since: AdminModerationSinceByKind): Promise<AdminModerationSummary> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    totalUsers,
    bannedUsers,
    totalReports,
    signupsLast24Hours,
    signupsLast7Days,
    signupsLast15Days,
    signupsLast30Days,
    reportsLast24Hours,
    reportsLast7Days,
    reportsLast15Days,
    reportsLast30Days,
    newUsersSince,
    newReportsSince,
    newAppFeedbackSince,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.report.count(),
    prisma.user.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: fifteenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.report.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
    prisma.report.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.report.count({ where: { createdAt: { gte: fifteenDaysAgo } } }),
    prisma.report.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: since.users } } }),
    prisma.report.count({ where: { createdAt: { gte: since.reports } } }),
    prisma.appFeedback.count({ where: { createdAt: { gte: since.feedback } } }),
  ]);
  return {
    totalUsers,
    bannedUsers,
    totalReports,
    signupsLast24Hours,
    signupsLast7Days,
    signupsLast15Days,
    signupsLast30Days,
    reportsLast24Hours,
    reportsLast7Days,
    reportsLast15Days,
    reportsLast30Days,
    newUsersSince,
    newReportsSince,
    newAppFeedbackSince,
  };
}

export async function prismaSetUserBanned(userId: string, banned: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: banned ? { isBanned: true, banUntil: null } : { isBanned: false, banUntil: null },
  });
}

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  banUntil: Date | null;
  createdAt: Date;
};

export async function prismaGetUsersForAdmin(search?: string): Promise<AdminUserRow[]> {
  const q = search?.trim();
  const where = q
    ? { OR: [{ id: q }, { email: { contains: q, mode: "insensitive" as const } }] }
    : undefined;
  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, role: true, isBanned: true, banUntil: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return users;
}

export type AdminModerationMessageRow = {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  createdAt: Date;
  fromEmail: string;
  toEmail: string;
};

/** Ultimele mesaje pentru scanare moderare (doar admin). */
export async function prismaAdminFetchMessagesForModerationScan(
  take: number,
  opts: { onlyWithAttachment?: boolean; onlyNonEmptyText?: boolean }
): Promise<AdminModerationMessageRow[]> {
  const cap = Math.min(Math.max(take, 1), 5000);
  const where: Prisma.MessageWhereInput = {};
  if (opts.onlyWithAttachment) {
    where.attachmentUrl = { not: null };
  }
  if (opts.onlyNonEmptyText) {
    where.text = { not: "" };
  }
  const rows = await prisma.message.findMany({
    where: { AND: [where, prismaMessageWhereChatVisible()] },
    orderBy: { createdAt: "desc" },
    take: cap,
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      text: true,
      attachmentUrl: true,
      attachmentContentType: true,
      createdAt: true,
      fromUser: { select: { email: true } },
      toUser: { select: { email: true } },
    },
  });
  return rows.map((m) => ({
    id: m.id,
    fromUserId: m.fromUserId,
    toUserId: m.toUserId,
    text: m.text,
    attachmentUrl: m.attachmentUrl,
    attachmentContentType: m.attachmentContentType,
    createdAt: m.createdAt,
    fromEmail: m.fromUser.email,
    toEmail: m.toUser.email,
  }));
}

/**
 * Există rând în User (valid pentru FK la Message), chiar dacă lipsește Profile —
 * prismaFindUserById returnează null fără profil, dar mesajele tot trebuie să poată fi trimise dacă userul există.
 */
export async function prismaUserRowExists(userId: string): Promise<boolean> {
  try {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    return row != null;
  } catch {
    return false;
  }
}

/** Apel în așteptare pentru callee — persistat în DB (Vercel serverless). */
export async function prismaUpsertPendingIncomingCall(
  toUserId: string,
  fromId: string,
  roomId: string,
  audioOnly: boolean
): Promise<void> {
  await prisma.pendingIncomingCall.upsert({
    where: { toUserId },
    create: { toUserId, fromId, roomId, audioOnly },
    /** Resetează createdAt la fiecare apel nou — altfel TTL-ul ar șterge imediat la re-sunare după un pending vechi. */
    update: { fromId, roomId, audioOnly, createdAt: new Date() },
  });
}

async function prismaUpsertMissedCallForPendingRow(
  db: Prisma.TransactionClient | typeof prisma,
  row: { roomId: string; toUserId: string; fromId: string; audioOnly: boolean; createdAt: Date }
): Promise<void> {
  await db.missedCall.upsert({
    where: { roomId: row.roomId },
    create: {
      roomId: row.roomId,
      toUserId: row.toUserId,
      fromId: row.fromId,
      audioOnly: row.audioOnly,
      ringAt: row.createdAt,
    },
    update: { toUserId: row.toUserId },
  });
}

export async function prismaListMissedCallsForUser(
  userId: string,
  take = 50
): Promise<Array<{ fromId: string; at: string; audioOnly: boolean }>> {
  try {
    const rows = await prisma.missedCall.findMany({
      where: { toUserId: userId },
      orderBy: { ringAt: "desc" },
      take,
    });
    return rows.map((r) => ({
      fromId: r.fromId,
      at: r.ringAt.toISOString(),
      audioOnly: r.audioOnly,
    }));
  } catch {
    return [];
  }
}

export async function prismaClearMissedCallsForUser(userId: string): Promise<void> {
  try {
    await prisma.missedCall.deleteMany({ where: { toUserId: userId } });
  } catch {
    /* ignore */
  }
}

export async function prismaGetPendingIncomingCall(
  toUserId: string
): Promise<{ fromId: string; roomId: string; audioOnly: boolean; pendingSince: string } | null> {
  try {
    const row = await prisma.pendingIncomingCall.findUnique({ where: { toUserId } });
    if (!row) return null;
    if (Date.now() - row.createdAt.getTime() > RING_PENDING_MAX_MS) {
      try {
        await prisma.$transaction(async (tx) => {
          await prismaUpsertMissedCallForPendingRow(tx, row);
          await tx.pendingIncomingCall.delete({ where: { toUserId } });
        });
      } catch {
        await prisma.pendingIncomingCall.delete({ where: { toUserId } }).catch(() => {});
      }
      return null;
    }
    return {
      fromId: row.fromId,
      roomId: row.roomId,
      audioOnly: row.audioOnly,
      pendingSince: row.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Caută pending după `roomId` (1-la-1). Complement la `prismaGetPendingIncomingCall(toUserId)`:
 * uneori e mai sigur să aliniezi starea după camera de apel decât doar după utilizatorul sunat.
 */
export async function prismaGetPendingIncomingRowByRoomId(
  roomId: string
): Promise<{ fromId: string; toUserId: string; roomId: string } | null> {
  try {
    const row = await prisma.pendingIncomingCall.findFirst({
      where: { roomId },
      select: { fromId: true, toUserId: true, roomId: true, createdAt: true },
    });
    if (!row) return null;
    if (Date.now() - row.createdAt.getTime() > RING_PENDING_MAX_MS) return null;
    return { fromId: row.fromId, toUserId: row.toUserId, roomId: row.roomId };
  } catch {
    return null;
  }
}

export async function prismaDeletePendingIncomingCall(toUserId: string): Promise<void> {
  try {
    await prisma.pendingIncomingCall.delete({ where: { toUserId } });
  } catch {
    /* P2025 */
  }
}

/** Caller închide / anulează — nu mai arăta „apel primit” pentru acel room. */
export async function prismaDeletePendingIncomingByRoomId(
  roomId: string,
  opts?: { endedByUserId?: string; recordMissedIfCaller?: boolean }
): Promise<void> {
  try {
    const endedBy = opts?.endedByUserId;
    await prisma.$transaction(async (tx) => {
      const rows = await tx.pendingIncomingCall.findMany({ where: { roomId } });
      const recordMissed =
        Boolean(opts?.recordMissedIfCaller && endedBy) && rows.some((r) => r.fromId === endedBy);
      if (recordMissed && endedBy) {
        for (const row of rows) {
          if (row.fromId === endedBy) await prismaUpsertMissedCallForPendingRow(tx, row);
        }
      }
      await tx.pendingIncomingCall.deleteMany({ where: { roomId } });
    });
  } catch {
    /* ignore */
  }
}

export async function prismaMarkCallRejectedRoom(roomId: string): Promise<void> {
  try {
    await prisma.rejectedCallRoom.upsert({
      where: { roomId },
      create: { roomId },
      update: { createdAt: new Date() },
    });
  } catch {
    /* ignore */
  }
}

export async function prismaIsCallRejectedRoom(roomId: string): Promise<boolean> {
  try {
    const row = await prisma.rejectedCallRoom.findUnique({ where: { roomId } });
    if (!row) return false;
    if (Date.now() - row.createdAt.getTime() > REJECTED_CALL_ROOM_TTL_MS) {
      await prisma.rejectedCallRoom.delete({ where: { roomId } }).catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const ANSWERED_CALL_ROOM_TTL_MS = 30 * 60 * 1000;

export async function prismaClearRejectedCallRoom(roomId: string): Promise<void> {
  try {
    await prisma.rejectedCallRoom.delete({ where: { roomId } }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function prismaMarkAnsweredCallRoom(roomId: string): Promise<void> {
  try {
    await prisma.answeredCallRoom.upsert({
      where: { roomId },
      create: { roomId },
      update: { createdAt: new Date() },
    });
  } catch {
    /* ignore */
  }
}

export async function prismaIsCallAnsweredRoom(roomId: string): Promise<boolean> {
  try {
    const row = await prisma.answeredCallRoom.findUnique({ where: { roomId } });
    if (!row) return false;
    if (Date.now() - row.createdAt.getTime() > ANSWERED_CALL_ROOM_TTL_MS) {
      await prisma.answeredCallRoom.delete({ where: { roomId } }).catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function prismaClearAnsweredCallRoom(roomId: string): Promise<void> {
  try {
    await prisma.answeredCallRoom.delete({ where: { roomId } }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Înregistrare / refresh token FCM (Android). */
export async function prismaUpsertFcmPushDevice(
  userId: string,
  fcmToken: string,
  platform: string = "android"
): Promise<void> {
  await prisma.userPushDevice.upsert({
    where: { fcmToken },
    create: { userId, fcmToken, platform },
    update: { userId, platform, updatedAt: new Date() },
  });
}

/** Înregistrare / refresh token PushKit VoIP (iOS) — APNs push-type voip. */
export async function prismaUpsertVoipPushDevice(userId: string, apnsVoipToken: string): Promise<void> {
  await prisma.userPushDevice.upsert({
    where: { apnsVoipToken },
    create: { userId, apnsVoipToken, platform: "ios", fcmToken: null },
    update: { userId, platform: "ios", updatedAt: new Date() },
  });
}

/** @deprecated folosește prismaUpsertFcmPushDevice */
export async function prismaUpsertPushDevice(
  userId: string,
  fcmToken: string,
  platform: string = "android"
): Promise<void> {
  return prismaUpsertFcmPushDevice(userId, fcmToken, platform);
}

export async function prismaListFcmTokensForUser(userId: string): Promise<string[]> {
  const rows = await prisma.userPushDevice.findMany({
    where: { userId, fcmToken: { not: null } },
    select: { fcmToken: true },
  });
  return rows.map((r) => r.fcmToken!).filter(Boolean);
}

export async function prismaListVoipTokensForUser(userId: string): Promise<string[]> {
  const rows = await prisma.userPushDevice.findMany({
    where: { userId, apnsVoipToken: { not: null } },
    select: { apnsVoipToken: true },
  });
  return rows.map((r) => r.apnsVoipToken!).filter(Boolean);
}

export async function prismaDeletePushDeviceByToken(fcmToken: string): Promise<void> {
  try {
    await prisma.userPushDevice.delete({ where: { fcmToken } });
  } catch {
    /* P2025 */
  }
}

export async function prismaDeletePushDeviceByVoipToken(apnsVoipToken: string): Promise<void> {
  try {
    await prisma.userPushDevice.delete({ where: { apnsVoipToken } });
  } catch {
    /* P2025 */
  }
}

/** Șterge token doar dacă aparține userului (logout sigur). */
export async function prismaDeletePushDeviceIfOwned(
  userId: string,
  token: string,
  kind: "fcm" | "voip" = "fcm"
): Promise<void> {
  if (kind === "voip") {
    await prisma.userPushDevice.deleteMany({ where: { userId, apnsVoipToken: token } });
  } else {
    await prisma.userPushDevice.deleteMany({ where: { userId, fcmToken: token } });
  }
}

export async function prismaDeletePushDevicesForUser(userId: string): Promise<void> {
  await prisma.userPushDevice.deleteMany({ where: { userId } });
}

// ——— Web Push (browser, VAPID) ———

export async function prismaUpsertWebPushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth },
    update: { userId, p256dh, auth, updatedAt: new Date() },
  });
}

export async function prismaListWebPushSubscriptionsForUser(userId: string): Promise<
  { endpoint: string; p256dh: string; auth: string }[]
> {
  const rows = await prisma.webPushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return rows;
}

export async function prismaDeleteWebPushSubscription(endpoint: string): Promise<void> {
  try {
    await prisma.webPushSubscription.delete({ where: { endpoint } });
  } catch {
    /* P2025 */
  }
}

export async function prismaDeleteWebPushSubscriptionsForUser(userId: string): Promise<void> {
  await prisma.webPushSubscription.deleteMany({ where: { userId } });
}

export async function prismaDeleteWebPushIfOwned(userId: string, endpoint: string): Promise<void> {
  await prisma.webPushSubscription.deleteMany({ where: { userId, endpoint } });
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

/**
 * Producție: Prisma dacă există DATABASE_URL.
 * Development: dacă există DATABASE_URL → Prisma (date persistente); altfel → store în memorie.
 */
export function isPrismaAvailable(): boolean {
  const hasDb = !!process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production") return hasDb;
  // DEV: dacă avem DATABASE_URL, folosim Prisma ca să nu se mai piardă datele în RAM
  if (hasDb) {
    logDevPrismaNoticeOnce();
    return true;
  }
  return false;
}
