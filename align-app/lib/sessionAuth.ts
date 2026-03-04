/**
 * Helper pentru autentificare: citește cookie align_sid sau header x-user-id.
 * Când sesiunea e validă, actualizează lastUsedAt pe device.
 */

import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "./sessions";
import { updateDeviceLastUsed } from "./devices";

export interface AuthResult {
  userId: string | null;
  deviceId: string | null;
  fromCookie: boolean;
}

/**
 * Pentru Route Handlers (request: Request): citește cookie din request.headers.
 */
export function getAuthFromRequest(request: Request): AuthResult {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const sessionId = match ? match[1].trim() : null;
  if (sessionId) {
    const entry = getSession(sessionId);
    if (entry) {
      updateDeviceLastUsed(entry.deviceId);
      return {
        userId: entry.userId,
        deviceId: entry.deviceId,
        fromCookie: true,
      };
    }
  }
  const sessionToken = request.headers.get("x-session-token")?.trim() || null;
  const userId = request.headers.get("x-user-id")?.trim() || null;
  if (sessionToken && userId) {
    const entry = getSession(sessionToken);
    if (entry && entry.userId === userId) {
      updateDeviceLastUsed(entry.deviceId);
      return { userId: entry.userId, deviceId: entry.deviceId, fromCookie: false };
    }
  }
  return { userId: null, deviceId: null, fromCookie: false };
}

/**
 * Pentru Server Components / server actions: citește cookie din next/headers.
 */
export async function getAuthFromHeaders(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const entry = getSession(sessionId);
    if (entry) {
      updateDeviceLastUsed(entry.deviceId);
      return {
        userId: entry.userId,
        deviceId: entry.deviceId,
        fromCookie: true,
      };
    }
  }
  return { userId: null, deviceId: null, fromCookie: false };
}

/**
 * Returnează userId dacă există sesiune (cookie align_sid sau header x-user-id).
 * Existența userului în store sau Prisma se verifică în fiecare rută API (findUserOrPrisma).
 */
export function getAuthenticatedUserId(request: Request): string | null {
  const { userId } = getAuthFromRequest(request);
  return userId || null;
}
