/**
 * Autentificare: cookie `align_sid` sau `x-session-token` + `x-user-id` (userId trebuie să coincidă cu sesiunea).
 */

import { cookies } from "next/headers";
import { getSessionAsync, SESSION_COOKIE } from "./sessions";
import { updateDeviceLastUsed } from "./devices";

export interface AuthResult {
  userId: string | null;
  deviceId: string | null;
  fromCookie: boolean;
}

export async function getAuthFromRequest(request: Request): Promise<AuthResult> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const sessionId = match ? match[1].trim() : null;
  if (sessionId) {
    const entry = await getSessionAsync(sessionId);
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
    const entry = await getSessionAsync(sessionToken);
    if (entry && entry.userId === userId) {
      updateDeviceLastUsed(entry.deviceId);
      return { userId: entry.userId, deviceId: entry.deviceId, fromCookie: false };
    }
  }
  return { userId: null, deviceId: null, fromCookie: false };
}

export async function getAuthFromHeaders(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const entry = await getSessionAsync(sessionId);
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

export async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const { userId } = await getAuthFromRequest(request);
  return userId || null;
}

export async function resolveRequestUserId(request: Request): Promise<string | null> {
  return await getAuthenticatedUserId(request);
}
