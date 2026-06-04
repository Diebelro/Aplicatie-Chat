/**
 * Header-e de autentificare pentru request-uri API (x-user-id, x-session-token, x-device-id).
 * Folosiți getAuthHeaders() la toate fetch-urile către /api/* din zona app.
 */

import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";

export function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const raw = getStoredUserRaw();
  if (!raw) return {};
  try {
    const u = JSON.parse(raw) as User;
    const id = u?.id != null ? String(u.id).trim() : "";
    if (!id) return {};
    const sessionToken = sessionStorage.getItem("align_session_token") || localStorage.getItem("align_session_token");
    const deviceId = sessionStorage.getItem("align_device_id") || localStorage.getItem("align_device_id");
    const fingerprint = sessionStorage.getItem("align_device_fingerprint") || localStorage.getItem("align_device_fingerprint");
    const headers: Record<string, string> = { "x-user-id": id };
    if (sessionToken) headers["x-session-token"] = sessionToken;
    if (deviceId) headers["x-device-id"] = deviceId;
    if (fingerprint) headers["x-device-fingerprint"] = fingerprint;
    return headers;
  } catch {
    return {};
  }
}

/**
 * Fetch cu cookie + headere sesiune și un retry scurt la 401 (serverless / cursă la login).
 */
export async function fetchWithAuthRetry(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const buildInit = (): RequestInit => {
    const base = new Headers(init.headers);
    const auth = getAuthHeaders();
    if (auth && typeof auth === "object" && !Array.isArray(auth)) {
      for (const [k, v] of Object.entries(auth as Record<string, string>)) {
        if (v) base.set(k, v);
      }
    }
    return { ...init, headers: base, credentials: "include" as const };
  };
  let res = await fetch(input, buildInit());
  if (typeof window !== "undefined" && res.status === 401) {
    await new Promise((r) => setTimeout(r, 400));
    res = await fetch(input, buildInit());
  }
  return res;
}

/** Înainte de navigare la /admin: cookie httpOnly trebuie setat (middleware nu vede tokenul din storage). */
export async function ensureSessionCookieForNavigation(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const token =
    sessionStorage.getItem("align_session_token") || localStorage.getItem("align_session_token");
  if (!token) return true;
  try {
    const res = await fetchWithAuthRetry("/api/auth/sync-session-cookie", {
      method: "POST",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
