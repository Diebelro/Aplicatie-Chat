import { RING_PENDING_MAX_MS } from "./callRingConstants";

/** În browser: citește user din localStorage sau sessionStorage („Ține-mă minte”). */
export function getStoredUserRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("align_user") || sessionStorage.getItem("align_user");
}

export type Gender = "male" | "female" | "other";

export interface User {
  id: string;
  /** Public display: use @username everywhere in UI. Kept for backward compat. */
  name: string;
  /** Unique, required, public. Shown as @username in UI. */
  username: string;
  /** Optional, private, visible only in Account Settings. */
  real_name?: string | null;
  email: string;
  bio: string;
  age?: number;
  gender?: Gender;
  /** Data nașterii (YYYY-MM-DD) */
  birthDate?: string;
  /** Țara (ex. România, Germany) – pentru căutare/filtru */
  country?: string | null;
  city?: string;
  /** Location (stored on user; also synced to userPositions when location_enabled) */
  latitude?: number | null;
  longitude?: number | null;
  location_enabled?: boolean;
  /** Privacy: show my distance to others (default true) */
  show_distance?: boolean;
  /** Privacy: show online status (default true) */
  show_online?: boolean;
  /** Privacy: allow others to see when I visit their profile (default true) */
  show_profile_visits?: boolean;
  /** Privacy: send read receipts (default true) */
  show_read_receipts?: boolean;
  /** Privacy: allow friend requests (default true) */
  allow_friend_requests?: boolean;
  /** Last activity timestamp (ms); updated on setUserActive */
  last_active?: number | null;
  /** Cod poștal */
  postalCode?: string;
  /** Nivel de educație */
  educationLevel?: string;
  /** Ocupație */
  occupation?: string;
  /** Statut marital */
  maritalStatus?: string;
  /** Dorință de copii */
  wantsChildren?: string;
  /** Înălțime în cm */
  height?: number;
  /** Greutate în kg */
  weight?: number;
  /** Culoare ochi */
  eyeColor?: string;
  /** Culoare păr */
  hairColor?: string;
  /** Tip corp / silueta */
  bodyType?: string;
  /** Stil vestimentar */
  clothingStyle?: string;
  /** Trăsături distinctive (ochelari, tatuaje etc.) */
  distinctiveFeatures?: string;
  /** Atu fizic (opțional) */
  physicalAsset?: string;
  /** Detaliu atu fizic (opțional, max 40 caractere) */
  physicalAssetDetail?: string;
  /** Preferințe fizice în partener */
  partnerPhysicalPreferences?: string;
  /** Stil de viață dorit la partener */
  partnerLifestyle?: string;
  /** Obiceiuri neacceptate (fumat, alcool etc.) */
  partnerDealBreakers?: string;
  /** URL-uri sau data URL-uri pentru poze profil (max 5) */
  photos?: string[];
  createdAt: string;
  /** Premium permanent (cumpărat o dată) */
  premium_permanent?: boolean;
  /** Premium temporar până la acest timestamp (ms); folosit și pentru rewarded 1h */
  premium_until?: number | null;
  /** Număr de activări rewarded astăzi (max 3/zi) */
  rewarded_activations_today?: number;
  /** Data (YYYY-MM-DD) pentru care e numărat rewarded_activations_today */
  rewarded_activations_date?: string;
  /** Abonament: plan id (ex. monthly, yearly, lifetime) */
  subscription_plan_id?: string | null;
  /** active | canceled | past_due | null */
  subscription_status?: string | null;
  /** Sfârșitul perioadei curente (ISO) */
  subscription_current_period_end?: string | null;
  /** Trust score 0–100 pentru filtrare anti-fake (fără blocare țări); calculat din completitudine profil, vârsta contului */
  trust_score?: number | null;
  /** Rol: USER | ADMIN | SUPERADMIN */
  role?: string;
  /** Cont blocat de admin */
  isBanned?: boolean;
  /** Suspendare temporară — ISO; acces blocat până la acest moment */
  banUntil?: string | null;
}

export interface Match {
  fromId: string;
  toId: string;
  liked: boolean;
  at: string;
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string;
  attachmentUrl?: string | null;
  attachmentContentType?: string | null;
  /** Doar modul Prisma: mesaj centrat ca notificare de sistem în chat. */
  isPlatformNotice?: boolean;
}

/** Singleton pe globalThis ca login și signup (chiar din chunk-uri diferite Next.js) să partajeze aceleași date. */
const STORE_KEY = "__align_app_store__";
/** Perechi mutual match (userA, userB) — compatibil cu spec-ul addMatch(a, b). */
export interface MutualMatchPair {
  userA: string;
  userB: string;
  createdAt: number;
}

type StoreState = {
  users: User[];
  passwordHashes: Map<string, string>;
  matches: Match[];
  mutualMatchPairs: MutualMatchPair[];
  messages: Message[];
  lastActivityByUserId: Map<string, number>;
  userPositions: Map<string, { lat: number; lng: number }>;
  lastLikeTimestampsByUser: Map<string, number[]>;
  storeId: string;
};

function getState(): StoreState {
  const g = globalThis as unknown as Record<string, StoreState>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      users: [],
      passwordHashes: new Map(),
      matches: [],
      mutualMatchPairs: [],
      messages: [],
      lastActivityByUserId: new Map(),
      userPositions: new Map(),
      lastLikeTimestampsByUser: new Map(),
      storeId: `store-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
  }
  return g[STORE_KEY];
}

export function getStoreId(): string {
  return getState().storeId;
}
export function getUsersCount(): number {
  return getState().users.length;
}

export function setPassword(userId: string, hashedPassword: string): void {
  getState().passwordHashes.set(userId, hashedPassword);
}

export function getPasswordHash(userId: string): string | undefined {
  return getState().passwordHashes.get(userId);
}
const LIKE_RATE_WINDOW_MS = 1000;
const LIKE_RATE_MAX_PER_WINDOW = 5;

/** Returnează true dacă utilizatorul poate trimite un like (nu a depășit viteza imposibilă). */
export function canPerformLike(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - LIKE_RATE_WINDOW_MS;
  const m = getState().lastLikeTimestampsByUser;
  let list = m.get(userId) ?? [];
  list = list.filter((t) => t > cutoff);
  if (list.length >= LIKE_RATE_MAX_PER_WINDOW) return false;
  list.push(now);
  m.set(userId, list);
  return true;
}

/** Trust score 0–100 pentru filtrare anti-fake (fără blocare țări). */
export function getTrustScore(user: User): number {
  let score = 0;
  if (user.photos && user.photos.length > 0) score += 20;
  if (user.bio && user.bio.trim().length >= 10) score += 15;
  if (user.age != null && user.age >= 18) score += 10;
  if (user.city && user.city.trim().length > 0) score += 10;
  if (user.country && String(user.country).trim().length > 0) score += 5;
  const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
  const days = created ? Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000)) : 0;
  score += Math.min(40, Math.floor(days / 3));
  return Math.min(100, score);
}

/** Online doar dacă utilizatorul e pe site acum (heartbeat în ultimele 15 secunde). */
const ONLINE_SECONDS = 60; // sub 1 min = instant ca WhatsApp

export function setUserActive(userId: string): void {
  const now = Date.now();
  const s = getState();
  s.lastActivityByUserId.set(userId, now);
  const i = s.users.findIndex((u) => u.id === userId);
  if (i >= 0) s.users[i].last_active = now;
}

export function isUserOnline(userId: string): boolean {
  const t = getState().lastActivityByUserId.get(userId);
  if (!t) return false;
  return Date.now() - t < ONLINE_SECONDS * 1000;
}

/** Whether to show online status to others (respects user's show_online). */
export function isUserOnlineVisible(userId: string): boolean {
  const u = findUserById(userId);
  if (u?.show_online === false) return false;
  return isUserOnline(userId);
}

/** Last activity timestamp (ms) for "last active X min ago". */
export function getLastActivityAt(userId: string): number | undefined {
  return getState().lastActivityByUserId.get(userId);
}

export function setUserPosition(userId: string, lat: number, lng: number): void {
  getState().userPositions.set(userId, { lat, lng });
}

export function getUserPosition(userId: string): { lat: number; lng: number } | undefined {
  const u = findUserById(userId);
  if (u?.latitude != null && u?.longitude != null) return { lat: u.latitude, lng: u.longitude };
  return getState().userPositions.get(userId);
}

/** Set user location and sync to userPositions. */
export function setUserLocation(
  userId: string,
  lat: number | null,
  lng: number | null,
  location_enabled: boolean
): void {
  const s = getState();
  const i = s.users.findIndex((u) => u.id === userId);
  if (i < 0) return;
  s.users[i].latitude = lat ?? undefined;
  s.users[i].longitude = lng ?? undefined;
  s.users[i].location_enabled = location_enabled;
  if (location_enabled && lat != null && lng != null) {
    s.userPositions.set(userId, { lat, lng });
  } else {
    s.userPositions.delete(userId);
  }
}

/** Distance from viewer to target. Returns null if target hides distance or has no location. */
export function getDistanceKmForDisplay(viewerId: string, targetId: string): number | null {
  const target = findUserById(targetId);
  if (!target?.location_enabled || target.show_distance === false) return null;
  const p1 = getUserPosition(viewerId);
  const p2 = getUserPosition(targetId);
  if (!p1 || !p2) return null;
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Listă utilizatori online care au poziție setată (pentru hartă), excluzând meId. */
export function getOnlineUsersWithPositions(meId: string): {
  id: string;
  name: string;
  username: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  online: boolean;
}[] {
  const s = getState();
  const result: {
    id: string;
    name: string;
    username: string;
    lat: number;
    lng: number;
    photoUrl: string | null;
    online: boolean;
  }[] = [];
  for (const u of s.users) {
    if (u.id === meId || !isUserOnline(u.id)) continue;
    const pos = s.userPositions.get(u.id);
    if (!pos) continue;
    result.push({
      id: u.id,
      name: u.name,
      username: u.username ?? u.name,
      lat: pos.lat,
      lng: pos.lng,
      photoUrl: u.photos?.[0] ?? null,
      online: isUserOnlineVisible(u.id),
    });
  }
  return result;
}

/** Distanță în km (Haversine). Returnează null dacă lipsește o poziție. */
export function getDistanceKm(userId1: string, userId2: string): number | null {
  const up = getState().userPositions;
  const p1 = up.get(userId1);
  const p2 = up.get(userId2);
  if (!p1 || !p2) return null;
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DEFAULT_PRIVACY = {
  show_distance: true,
  show_online: true,
  show_profile_visits: true,
  show_read_receipts: true,
  allow_friend_requests: true,
  location_enabled: false,
};

const REWARDED_MAX_PER_DAY = 3;
const REWARDED_DURATION_MS = 60 * 60 * 1000; // 1 oră

export function createUser(data: Omit<User, "id" | "createdAt">): User {
  const username = String((data as User).username ?? "").trim();
  if (!username) throw new Error("username is required");
  const user: User = {
    ...data,
    name: data.name || username,
    username: username.toLowerCase(),
    real_name: (data as User).real_name ?? null,
    country: (data as User).country ?? null,
    latitude: (data as User).latitude ?? null,
    longitude: (data as User).longitude ?? null,
    ...DEFAULT_PRIVACY,
    last_active: null,
    id: generateId(),
    createdAt: new Date().toISOString(),
    premium_permanent: (data as User).premium_permanent ?? false,
    premium_until: (data as User).premium_until ?? null,
    rewarded_activations_today: 0,
    rewarded_activations_date: new Date().toISOString().slice(0, 10),
    subscription_plan_id: null,
    subscription_status: null,
    subscription_current_period_end: null,
  };
  getState().users.push(user);
  return user;
}

export function findUserByEmail(email: string): User | undefined {
  return getState().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserByUsername(username: string): User | undefined {
  const normalized = String(username ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return getState().users.find((u) => u.username?.toLowerCase() === normalized);
}

/** Check if username is taken. Pass excludeUserId when editing own profile. */
export function isUsernameTaken(username: string, excludeUserId?: string): boolean {
  const u = findUserByUsername(username);
  if (!u) return false;
  return excludeUserId ? u.id !== excludeUserId : true;
}

export function findUserById(id: string): User | undefined {
  return getState().users.find((u) => u.id === id);
}

export function getAllUsersExcept(excludeUserId: string): User[] {
  return getState().users.filter((u) => u.id !== excludeUserId);
}

export interface ProfileFilters {
  gender?: Gender | "";
  minAge?: number;
  maxAge?: number;
  maxDistanceKm?: number;
  country?: string;
  city?: string;
  /** Doar utilizatori online */
  onlineOnly?: boolean;
  /** Caută în nume (substring, ignoră majuscule) */
  name?: string;
}

/** Normalizează pentru potrivire strictă: trim, lowercase, fără diacritice. */
function normalizeStrictMatch(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Filtrează utilizatori după gen, vârstă, distanță, țară, oraș, online, nume. */
export function filterUsers(
  list: User[],
  myId: string,
  filters: ProfileFilters
): User[] {
  return list.filter((u) => {
    const g = filters.gender;
    if (g != null && g !== "" && u.gender !== g)
      return false;
    if (filters.minAge != null && (u.age == null || u.age < filters.minAge))
      return false;
    if (filters.maxAge != null && (u.age == null || u.age > filters.maxAge))
      return false;
    if (filters.country && filters.country.trim() !== "") {
      if (normalizeStrictMatch(u.country ?? "") !== normalizeStrictMatch(filters.country)) return false;
    }
    if (filters.city && filters.city.trim() !== "") {
      if (normalizeStrictMatch(u.city ?? "") !== normalizeStrictMatch(filters.city)) return false;
    }
    if (filters.maxDistanceKm != null && filters.maxDistanceKm > 0) {
      const km = getDistanceKm(myId, u.id);
      if (km == null || km > filters.maxDistanceKm) return false;
    }
    if (filters.onlineOnly && !isUserOnline(u.id)) return false;
    if (filters.name && filters.name.trim() !== "") {
      const nameLower = filters.name.trim().toLowerCase();
      const uName = (u.name ?? "").toLowerCase();
      const uUsername = (u.username ?? "").toLowerCase();
      if (!uName.includes(nameLower) && !uUsername.includes(nameLower)) return false;
    }
    return true;
  });
}

export function updateUser(
  userId: string,
  data: Partial<Omit<User, "id" | "createdAt">>
): User | undefined {
  const u = getState().users;
  const i = u.findIndex((x) => x.id === userId);
  if (i < 0) return undefined;
  if ((data as User).username != null) {
    (data as User).username = String((data as User).username).trim().toLowerCase();
  }
  u[i] = { ...u[i], ...data };
  return u[i];
}

/** Utilizatorul are premium (permanent sau temporar în vigoare). */
export function isPremium(user: User): boolean {
  if (user.premium_permanent) return true;
  const until = user.premium_until;
  if (until != null && typeof until === "number" && Date.now() < until) return true;
  return false;
}

/** Resetează contorul rewarded dacă s-a schimbat ziua. */
function resetRewardedIfNewDay(user: User): void {
  const today = new Date().toISOString().slice(0, 10);
  if (user.rewarded_activations_date !== today) {
    user.rewarded_activations_today = 0;
    user.rewarded_activations_date = today;
  }
}

export interface RewardedState {
  activationsToday: number;
  maxPerDay: number;
  canActivate: boolean;
  premiumUntil: number | null;
}

export function getRewardedState(userId: string): RewardedState | null {
  const u = findUserById(userId);
  if (!u) return null;
  resetRewardedIfNewDay(u);
  const activationsToday = u.rewarded_activations_today ?? 0;
  const maxPerDay = REWARDED_MAX_PER_DAY;
  const canActivate = activationsToday < maxPerDay && !isPremium(u);
  const premiumUntil = u.premium_until != null && u.premium_until > Date.now() ? u.premium_until : null;
  return { activationsToday, maxPerDay, canActivate, premiumUntil };
}

/** Activează 1h premium rewarded. Max 3/zi. Returnează { ok, error?, premiumUntil?, activationsLeft? }. */
export function activateRewarded(userId: string): { ok: boolean; error?: string; premiumUntil?: number; activationsLeft?: number } {
  const u = findUserById(userId);
  if (!u) return { ok: false, error: "Utilizator negăsit." };
  resetRewardedIfNewDay(u);
  if (isPremium(u)) return { ok: false, error: "Ai deja Premium activ." };
  const count = u.rewarded_activations_today ?? 0;
  if (count >= REWARDED_MAX_PER_DAY) return { ok: false, error: "Ai atins limita de 3 activări pe zi." };
  const now = Date.now();
  const currentEnd = u.premium_until != null && u.premium_until > now ? u.premium_until : now;
  const newEnd = currentEnd + REWARDED_DURATION_MS;
  u.premium_until = newEnd;
  u.rewarded_activations_today = count + 1;
  u.rewarded_activations_date = new Date().toISOString().slice(0, 10);
  const left = REWARDED_MAX_PER_DAY - (count + 1);
  return { ok: true, premiumUntil: newEnd, activationsLeft: left };
}

/** Delete user and all related data (friends, messages, visits, reads, matches, devices, sessions). */
export function deleteUser(userId: string): boolean {
  const s = getState();
  const i = s.users.findIndex((u) => u.id === userId);
  if (i < 0) return false;

  const { clearAllSessionsForUserInMemory } = require("@/lib/sessions");
  const { deleteDevicesForUser } = require("@/lib/devices");

  s.passwordHashes.delete(userId);
  s.lastActivityByUserId.delete(userId);
  s.userPositions.delete(userId);
  userPrivacySettingsLegacy.delete(userId);
  s.lastLikeTimestampsByUser.delete(userId);

  for (let j = s.matches.length - 1; j >= 0; j--) {
    if (s.matches[j].fromId === userId || s.matches[j].toId === userId) s.matches.splice(j, 1);
  }
  for (let j = s.mutualMatchPairs.length - 1; j >= 0; j--) {
    if (s.mutualMatchPairs[j].userA === userId || s.mutualMatchPairs[j].userB === userId) s.mutualMatchPairs.splice(j, 1);
  }
  for (let j = s.messages.length - 1; j >= 0; j--) {
    if (s.messages[j].fromId === userId || s.messages[j].toId === userId) s.messages.splice(j, 1);
  }
  for (let j = friends.length - 1; j >= 0; j--) {
    if (friends[j].user_id === userId || friends[j].friend_id === userId) friends.splice(j, 1);
  }
  for (let j = profileVisits.length - 1; j >= 0; j--) {
    if (profileVisits[j].visitor_id === userId || profileVisits[j].visited_id === userId) profileVisits.splice(j, 1);
  }
  for (let j = messageReads.length - 1; j >= 0; j--) {
    if (messageReads[j].reader_id === userId) messageReads.splice(j, 1);
  }

  const keysToDelete: string[] = [];
  visits.forEach((key) => {
    if (key.startsWith(userId + ":") || key.endsWith(":" + userId)) keysToDelete.push(key);
  });
  keysToDelete.forEach((k) => visits.delete(k));

  lastReadAt.delete(userId);
  for (const [, map] of lastReadAt) {
    map.delete(userId);
  }

  clearAllSessionsForUserInMemory(userId);
  deleteDevicesForUser(userId);

  s.users.splice(i, 1);
  return true;
}

/** Înregistrează un swipe (like sau pass). Folosit intern de addLike/addPass. */
function recordSwipe(fromId: string, toId: string, liked: boolean): void {
  getState().matches.push({
    fromId,
    toId,
    liked,
    at: new Date().toISOString(),
  });
}

/** Spec: înregistrează like (swipe right). */
export function addLike(userId: string, targetId: string): void {
  recordSwipe(userId, targetId, true);
}

/** Spec: înregistrează pass (swipe left). */
export function addPass(userId: string, targetId: string): void {
  recordSwipe(userId, targetId, false);
}

/** Spec: înregistrează match mutual (addMatch(a, b)) — pereche userA, userB. */
export function addMatch(a: string, b: string): void {
  const pairs = getState().mutualMatchPairs;
  const key = [a, b].sort().join(":");
  if (pairs.some((p) => [p.userA, p.userB].sort().join(":") === key)) return;
  pairs.push({ userA: a, userB: b, createdAt: Date.now() });
}

export function getMatchesForUser(userId: string): Match[] {
  return getState().matches.filter((m) => m.fromId === userId || m.toId === userId);
}

export function hasSwiped(fromId: string, toId: string): boolean {
  return getState().matches.some((m) => m.fromId === fromId && m.toId === toId);
}

export function getSwipeFromTo(fromId: string, toId: string): { liked: boolean; at: string } | undefined {
  const m = getState().matches.find((x) => x.fromId === fromId && x.toId === toId);
  return m ? { liked: m.liked, at: m.at } : undefined;
}

export function mutualMatchPairExists(a: string, b: string): boolean {
  const key = [a, b].sort().join(":");
  return getState().mutualMatchPairs.some(
    (p) => [p.userA, p.userB].sort().join(":") === key
  );
}

/** Status swipe (like/dislike) pentru un singur pereche from→to. Pentru TEST_MODE feed (store path). */
export function getSwipeStatus(fromId: string, toId: string): { hasLiked: boolean; hasDisliked: boolean } {
  const m = getState().matches.find((x) => x.fromId === fromId && x.toId === toId);
  if (!m) return { hasLiked: false, hasDisliked: false };
  return { hasLiked: m.liked, hasDisliked: !m.liked };
}

/** ID-uri utilizatori la care am făcut dislike (pass) — aceștia nu apar în listă. */
export function getDislikedUserIds(userId: string): Set<string> {
  return new Set(
    getState().matches.filter((m) => m.fromId === userId && !m.liked).map((m) => m.toId)
  );
}

export function getMutualMatches(userId: string): User[] {
  const matches = getState().matches;
  const myLikes = new Set(
    matches.filter((m) => m.fromId === userId && m.liked).map((m) => m.toId)
  );
  const theyLikedMe = new Set(
    matches.filter((m) => m.toId === userId && m.liked).map((m) => m.fromId)
  );
  const mutual = [...myLikes].filter((id) => theyLikedMe.has(id));
  return mutual.map((id) => findUserById(id)).filter(Boolean) as User[];
}

export function isMutualMatch(userId1: string, userId2: string): boolean {
  const matches = getState().matches;
  const myLikes = new Set(
    matches.filter((m) => m.fromId === userId1 && m.liked).map((m) => m.toId)
  );
  const theyLikedMe = matches.some(
    (m) => m.fromId === userId2 && m.toId === userId1 && m.liked
  );
  return myLikes.has(userId2) && theyLikedMe;
}

/** Actualizează sau adaugă swipe (pentru recenzare / schimbare decizie). */
export function upsertUserSwipe(fromId: string, toId: string, liked: boolean): void {
  const s = getState().matches;
  const i = s.findIndex((m) => m.fromId === fromId && m.toId === toId);
  if (i >= 0) {
    s[i] = { ...s[i], liked, at: new Date().toISOString() };
    return;
  }
  recordSwipe(fromId, toId, liked);
}

/** Elimină perechea de match mutual din store (ex. după ce treci de la like la pass). */
export function removeMutualMatchPair(a: string, b: string): void {
  const pairs = getState().mutualMatchPairs;
  const key = [a, b].sort().join(":");
  for (let j = pairs.length - 1; j >= 0; j--) {
    const p = pairs[j];
    if ([p.userA, p.userB].sort().join(":") === key) pairs.splice(j, 1);
  }
}

/** Lista țintelor swipe-uite de mine (pentru recenzare), cele mai recente primele. */
export function listMySwipeTargetsForReview(userId: string): { toId: string; liked: boolean; at: string }[] {
  return getState()
    .matches.filter((m) => m.fromId === userId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((m) => ({ toId: m.toId, liked: m.liked, at: m.at }));
}

export function addMessage(
  fromId: string,
  toId: string,
  text: string,
  attachmentUrl?: string | null,
  attachmentContentType?: string | null
): Message {
  const msg: Message = {
    id: generateId(),
    fromId,
    toId,
    text: (text ?? "").trim(),
    at: new Date().toISOString(),
    attachmentUrl: attachmentUrl ?? undefined,
    attachmentContentType: attachmentContentType ?? undefined,
  };
  getState().messages.push(msg);
  return msg;
}

export function getMessagesBetween(userId1: string, userId2: string): Message[] {
  return getState().messages
    .filter(
      (m) =>
        (m.fromId === userId1 && m.toId === userId2) ||
        (m.fromId === userId2 && m.toId === userId1)
    )
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export interface ConversationSummary {
  otherUser: User;
  lastMessage: Message;
}

/** Toate conversațiile utilizatorului, ordonate după ultimul mesaj. */
export function getConversations(userId: string): ConversationSummary[] {
  const withMe = new Map<string, Message>();
  for (const m of getState().messages) {
    if (m.fromId !== userId && m.toId !== userId) continue;
    const other = m.fromId === userId ? m.toId : m.fromId;
    const existing = withMe.get(other);
    if (!existing || new Date(m.at) > new Date(existing.at)) {
      withMe.set(other, m);
    }
  }
  return Array.from(withMe.entries())
    .map(([otherId, lastMessage]) => ({
      otherUser: findUserById(otherId)!,
      lastMessage,
    }))
    .filter((c) => c.otherUser)
    .sort((a, b) => new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime());
}

/** Pentru fiecare (meId, otherId) = ultima dată când am „citit” conversația (ISO). Mesajele cu at > această dată sunt necitite. */
const lastReadAt = new Map<string, Map<string, string>>();

function getLastRead(meId: string, otherId: string): string {
  return lastReadAt.get(meId)?.get(otherId) ?? "0";
}

/** Marchează conversația cu otherId ca citită până la lastMessageAt (inclusiv). */
export function setConversationRead(meId: string, otherId: string, lastMessageAt: string): void {
  let map = lastReadAt.get(meId);
  if (!map) {
    map = new Map();
    lastReadAt.set(meId, map);
  }
  const existing = map.get(otherId);
  if (!existing || new Date(lastMessageAt) > new Date(existing)) {
    map.set(otherId, lastMessageAt);
  }
}

/** Număr de mesaje necitite de la otherId (trimise către meId). */
export function getUnreadFrom(meId: string, otherId: string): number {
  const since = getLastRead(meId, otherId);
  return getState().messages.filter(
    (m) => m.fromId === otherId && m.toId === meId && m.at > since
  ).length;
}

/** Total mesaje necitite (de la toți). */
export function getTotalUnread(meId: string): number {
  const convos = getConversations(meId);
  return convos.reduce((sum, c) => sum + getUnreadFrom(meId, c.otherUser.id), 0);
}

/** Apel în așteptare: cel care sună (fromId) a deschis roomId; cel sunat (toId) vede ring și poate răspunde/respinge. */
const pendingCallByToId = new Map<
  string,
  { fromId: string; roomId: string; at: string; audioOnly: boolean }
>();

const PENDING_CALL_EXPIRE_MS = RING_PENDING_MAX_MS;

export function setPendingCall(
  toId: string,
  data: { fromId: string; roomId: string; audioOnly?: boolean }
): void {
  pendingCallByToId.set(toId, {
    fromId: data.fromId,
    roomId: data.roomId,
    at: new Date().toISOString(),
    audioOnly: data.audioOnly ?? false,
  });
}

/** Apeluri pierdute (n-au răspuns): per utilizator (toId) lista de apeluri expirate. */
const missedCallsByUserId = new Map<
  string,
  Array<{ fromId: string; at: string; audioOnly: boolean }>
>();

export function getPendingCall(toId: string): {
  fromId: string;
  roomId: string;
  at: string;
  audioOnly: boolean;
} | null {
  const p = pendingCallByToId.get(toId);
  if (!p) return null;
  if (Date.now() - new Date(p.at).getTime() > PENDING_CALL_EXPIRE_MS) {
    pendingCallByToId.delete(toId);
    const list = missedCallsByUserId.get(toId) ?? [];
    list.push({ fromId: p.fromId, at: p.at, audioOnly: p.audioOnly });
    missedCallsByUserId.set(toId, list);
    return null;
  }
  return p;
}

export function clearPendingCall(toId: string): void {
  pendingCallByToId.delete(toId);
}

/** Șterge apelul în așteptare pentru orice utilizator al cărui roomId se potrivește (ex. caller închide înainte să răspundă). */
export function clearPendingCallByRoomId(roomId: string): void {
  for (const [toId, p] of pendingCallByToId) {
    if (p.roomId === roomId) pendingCallByToId.delete(toId);
  }
}

/** RoomIds rejected by callee so caller can be notified. Expire after 2 min. */
const rejectedCallRooms = new Map<string, number>();
const REJECTED_EXPIRE_MS = 2 * 60 * 1000;

export function addRejectedRoom(roomId: string): void {
  rejectedCallRooms.set(roomId, Date.now());
}

export function isRoomRejected(roomId: string): boolean {
  const at = rejectedCallRooms.get(roomId);
  if (!at) return false;
  if (Date.now() - at > REJECTED_EXPIRE_MS) {
    rejectedCallRooms.delete(roomId);
    return false;
  }
  return true;
}

export function getMissedCalls(userId: string): Array<{ fromId: string; at: string; audioOnly: boolean }> {
  return missedCallsByUserId.get(userId) ?? [];
}

export function clearMissedCalls(userId: string): void {
  missedCallsByUserId.set(userId, []);
}

// --- Friends (in-memory table) ---
export type FriendStatus = "pending" | "accepted" | "rejected";

export interface FriendRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
}

const friends: FriendRow[] = [];

function friendKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function addFriendRequest(fromId: string, toId: string): FriendRow | null {
  if (fromId === toId) return null;
  const existing = friends.find(
    (f) =>
      (f.user_id === fromId && f.friend_id === toId) ||
      (f.user_id === toId && f.friend_id === fromId)
  );
  if (existing) return null;
  const row: FriendRow = {
    id: generateId(),
    user_id: fromId,
    friend_id: toId,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  friends.push(row);
  return row;
}

export function acceptFriendRequest(userId: string, friendId: string): boolean {
  const row = friends.find(
    (f) => f.user_id === friendId && f.friend_id === userId && f.status === "pending"
  );
  if (!row) return false;
  row.status = "accepted";
  row.updated_at = new Date().toISOString();
  return true;
}

export function rejectFriendRequest(userId: string, friendId: string): boolean {
  const row = friends.find(
    (f) => f.user_id === friendId && f.friend_id === userId && f.status === "pending"
  );
  if (!row) return false;
  row.status = "rejected";
  row.updated_at = new Date().toISOString();
  return true;
}

export function removeFriend(userId: string, friendId: string): boolean {
  const i = friends.findIndex(
    (f) =>
      (f.user_id === userId && f.friend_id === friendId) ||
      (f.user_id === friendId && f.friend_id === userId)
  );
  if (i < 0) return false;
  friends.splice(i, 1);
  return true;
}

export function getFriendsList(userId: string): string[] {
  return friends
    .filter((f) => (f.user_id === userId || f.friend_id === userId) && f.status === "accepted")
    .map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
}

/** Returns status from current user's perspective: null | "pending_sent" | "pending_received" | "accepted" | "rejected" */
export function getFriendStatus(meId: string, otherId: string): "pending_sent" | "pending_received" | "accepted" | "rejected" | null {
  const row = friends.find(
    (f) =>
      (f.user_id === meId && f.friend_id === otherId) ||
      (f.user_id === otherId && f.friend_id === meId)
  );
  if (!row) return null;
  if (row.status === "accepted") return "accepted";
  if (row.status === "rejected") return "rejected";
  if (row.user_id === meId) return "pending_sent";
  return "pending_received";
}

export function getFriendRow(meId: string, otherId: string): FriendRow | undefined {
  return friends.find(
    (f) =>
      (f.user_id === meId && f.friend_id === otherId) ||
      (f.user_id === otherId && f.friend_id === meId)
  );
}

// --- Profile visits (table with created_at) ---
export interface ProfileVisitRow {
  id: string;
  visitor_id: string;
  visited_id: string;
  created_at: string;
}

const profileVisits: ProfileVisitRow[] = [];

const visits = new Set<string>();

function visitKey(userId: string, profileId: string) {
  return `${userId}:${profileId}`;
}

export function addVisit(userId: string, profileId: string): void {
  const key = visitKey(userId, profileId);
  if (visits.has(key)) return;
  visits.add(key);
  profileVisits.push({
    id: generateId(),
    visitor_id: userId,
    visited_id: profileId,
    created_at: new Date().toISOString(),
  });
}

export function hasVisited(userId: string, profileId: string): boolean {
  return visits.has(visitKey(userId, profileId));
}

/** Whether someone (visitedId) has visited my (visitorId) profile. */
export function hasBeenVisitedBy(visitorId: string, visitedId: string): boolean {
  return visits.has(visitKey(visitedId, visitorId));
}

export function getProfileVisitAt(visitorId: string, visitedId: string): string | undefined {
  const row = profileVisits
    .filter((v) => v.visitor_id === visitorId && v.visited_id === visitedId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  return row?.created_at;
}

// --- Message reads (read receipts) ---
export interface MessageReadRow {
  id: string;
  message_id: string;
  reader_id: string;
  read_at: string;
}

const messageReads: MessageReadRow[] = [];

export function addMessageRead(messageId: string, readerId: string): void {
  if (messageReads.some((r) => r.message_id === messageId && r.reader_id === readerId)) return;
  messageReads.push({
    id: generateId(),
    message_id: messageId,
    reader_id: readerId,
    read_at: new Date().toISOString(),
  });
}

export function getMessageReadBy(messageId: string): MessageReadRow[] {
  return messageReads.filter((r) => r.message_id === messageId);
}

export function hasMessageBeenReadBy(messageId: string, readerId: string): boolean {
  return messageReads.some((r) => r.message_id === messageId && r.reader_id === readerId);
}

export function getMessageReadAt(messageId: string, readerId: string): string | undefined {
  const r = messageReads.find((x) => x.message_id === messageId && x.reader_id === readerId);
  return r?.read_at;
}

/** Whether the other user has read at least one message I sent them (for "message seen" badge). */
export function getOtherHasReadMyMessage(meId: string, otherId: string): boolean {
  const between = getMessagesBetween(meId, otherId);
  const myMessages = between.filter((m) => m.fromId === meId);
  return myMessages.some((m) => hasMessageBeenReadBy(m.id, otherId));
}

// --- User privacy settings (read from User; fallback for legacy) ---
export interface UserPrivacySettings {
  allowFriendRequests: boolean;
  allowVisitVisibility: boolean;
  allowReadReceipts: boolean;
  show_distance?: boolean;
  show_online?: boolean;
}

const defaultPrivacySettings: UserPrivacySettings = {
  allowFriendRequests: true,
  allowVisitVisibility: true,
  allowReadReceipts: true,
  show_distance: true,
  show_online: true,
};

const userPrivacySettingsLegacy = new Map<string, UserPrivacySettings>();

function getPrivacySettingsFromUser(userId: string): UserPrivacySettings | null {
  const u = findUserById(userId);
  if (!u) return null;
  return {
    allowFriendRequests: u.allow_friend_requests !== false,
    allowVisitVisibility: u.show_profile_visits !== false,
    allowReadReceipts: u.show_read_receipts !== false,
    show_distance: u.show_distance !== false,
    show_online: u.show_online !== false,
  };
}

export function getUserPrivacySettings(userId: string): UserPrivacySettings {
  const fromUser = getPrivacySettingsFromUser(userId);
  if (fromUser) return fromUser;
  const s = userPrivacySettingsLegacy.get(userId);
  return s ? { ...defaultPrivacySettings, ...s } : { ...defaultPrivacySettings };
}

export function setUserPrivacySettings(
  userId: string,
  patch: Partial<UserPrivacySettings>
): UserPrivacySettings {
  const fromUser = getPrivacySettingsFromUser(userId);
  const next = { ...(fromUser ?? defaultPrivacySettings), ...patch };
  updateUser(userId, {
    allow_friend_requests: next.allowFriendRequests,
    show_profile_visits: next.allowVisitVisibility,
    show_read_receipts: next.allowReadReceipts,
    show_distance: next.show_distance,
    show_online: next.show_online,
  });
  return next;
}

/** Mark all messages in conversation (from otherId to meId) as read by meId. */
export function markConversationMessagesAsRead(meId: string, otherId: string): void {
  const between = getMessagesBetween(meId, otherId);
  for (const m of between) {
    if (m.toId === meId) addMessageRead(m.id, meId);
  }
}

export function hasSentMessageTo(meId: string, profileId: string): boolean {
  return getState().messages.some((m) => m.fromId === meId && m.toId === profileId);
}

/** True doar dacă există cel puțin un mesaj de la profileId către mine pe care nu l-am citit încă. După ce văd mesajul, dispare pentru acel user. */
export function hasReceivedMessageFrom(meId: string, profileId: string): boolean {
  const fromThemToMe = getState().messages.filter((m) => m.fromId === profileId && m.toId === meId);
  return fromThemToMe.some((m) => !hasMessageBeenReadBy(m.id, meId));
}

// 20 profiluri fake pentru demo (le poți șterge după ce vezi cum arată)
const FAKE_PROFILES: Omit<User, "id" | "createdAt">[] = [
  { name: "Maria Popescu", username: "maria_popescu", email: "maria.p@demo.ro", bio: "Iubesc călătoriile și cafeaua.", age: 28, gender: "female", city: "București" },
  { name: "Andrei Ionescu", username: "andrei_ionescu", email: "andrei.i@demo.ro", bio: "Developer, muzică și sport.", age: 26, gender: "male", city: "Cluj-Napoca" },
  { name: "Elena Marinescu", username: "elena_marinescu", email: "elena.m@demo.ro", bio: "Arte, filme, plimbări în natură.", age: 31, gender: "female", city: "București" },
  { name: "Alexandru Stan", username: "alexandru_stan", email: "alex.s@demo.ro", bio: "Startups și fotografie.", age: 24, gender: "male", city: "Timișoara" },
  { name: "Ioana Dobre", username: "ioana_dobre", email: "ioana.d@demo.ro", bio: "Cărți, yoga, bucătărie.", age: 29, gender: "female", city: "Iași" },
  { name: "Mihai Radu", username: "mihai_radu", email: "mihai.r@demo.ro", bio: "Fotbal, gaming, prieteni.", age: 27, gender: "male", city: "Cluj-Napoca" },
  { name: "Ana Constantinescu", username: "ana_constantinescu", email: "ana.c@demo.ro", bio: "Design, cafele, concerte.", age: 25, gender: "female", city: "Brașov" },
  { name: "David Moldovan", username: "david_moldovan", email: "david.m@demo.ro", bio: "Muzică live și drumeții.", age: 33, gender: "male", city: "București" },
  { name: "Sofia Nistor", username: "sofia_nistor", email: "sofia.n@demo.ro", bio: "Fashion, travel, food.", age: 22, gender: "female", city: "Constanța" },
  { name: "Stefan Georgescu", username: "stefan_georgescu", email: "stefan.g@demo.ro", bio: "Tech, citit, filme.", age: 30, gender: "male", city: "Sibiu" },
  { name: "Diana Enache", username: "diana_enache", email: "diana.e@demo.ro", bio: "Running, natură, voluntariat.", age: 26, gender: "female", city: "Cluj-Napoca" },
  { name: "Cristian Barbu", username: "cristian_barbu", email: "cristian.b@demo.ro", bio: "Gaming, filme SF, pizza.", age: 23, gender: "male", city: "București" },
  { name: "Laura Dumitrescu", username: "laura_dumitrescu", email: "laura.d@demo.ro", bio: "Arte, expoziții, cafea.", age: 28, gender: "female", city: "Timișoara" },
  { name: "Razvan Preda", username: "razvan_preda", email: "razvan.p@demo.ro", bio: "Fotbal, bere, prieteni.", age: 35, gender: "male", city: "Brașov" },
  { name: "Carmen Vasilescu", username: "carmen_vasilescu", email: "carmen.v@demo.ro", bio: "Yoga, meditație, cărți.", age: 27, gender: "female", city: "Iași" },
  { name: "Bogdan Neagu", username: "bogdan_neagu", email: "bogdan.n@demo.ro", bio: "Muzică, concerte, road trips.", age: 29, gender: "male", city: "Cluj-Napoca" },
  { name: "Raluca Popa", username: "raluca_popa", email: "raluca.p@demo.ro", bio: "Design, animale, natură.", age: 24, gender: "female", city: "București" },
  { name: "Adrian Florea", username: "adrian_florea", email: "adrian.f@demo.ro", bio: "Sport, gaming, filme.", age: 26, gender: "male", city: "Oradea" },
  { name: "Andreea Serban", username: "andreea_serban", email: "andreea.s@demo.ro", bio: "Călătorii, fotografii, food.", age: 31, gender: "female", city: "Sibiu" },
  { name: "Vlad Munteanu", username: "vlad_munteanu", email: "vlad.m@demo.ro", bio: "Startup, tech, networking.", age: 28, gender: "male", city: "București" },
];

export function seedFakeProfiles() {
  const u = getState().users;
  const hasFakes = u.some((x) => x.id.startsWith("fake-"));
  if (hasFakes) return;
  const baseTime = Date.now();
  FAKE_PROFILES.forEach((p, i) => {
    u.push({
      ...p,
      username: (p as User).username ?? `user_${i}`,
      real_name: null,
      country: (p as User).country ?? "România",
      latitude: null,
      longitude: null,
      location_enabled: false,
      show_distance: true,
      show_online: true,
      show_profile_visits: true,
      show_read_receipts: true,
      allow_friend_requests: true,
      last_active: null,
      premium_permanent: false,
      premium_until: null,
      rewarded_activations_today: 0,
      rewarded_activations_date: new Date().toISOString().slice(0, 10),
      subscription_plan_id: null,
      subscription_status: null,
      subscription_current_period_end: null,
      id: `fake-${i}-${baseTime}`,
      createdAt: new Date(baseTime + i).toISOString(),
    });
  });
}

// rulează seed la încărcarea modulului
seedFakeProfiles();
