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
