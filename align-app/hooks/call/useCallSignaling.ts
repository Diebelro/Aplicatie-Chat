"use client";

import { signalingWsConnectUrl } from "@/lib/webrtc/signaling";
import { pushCallDebug } from "@/hooks/call/callDebugLog";

export type SignalingGetAuthHeaders = () => HeadersInit;

export type SignalingTokenResult =
  | { ok: true; token: string }
  | { ok: false; status: number; message: string };

/**
 * `GET /api/call/signaling-token` — logică aliniată cu mesh + P2P din useWebRtcCall
 * (include ramura 404 doar când `include404TokenErrors` e true, ca în P2P).
 */
export async function fetchCallSignalingToken(
  getAuthHeaders: SignalingGetAuthHeaders,
  include404TokenErrors: boolean
): Promise<SignalingTokenResult> {
  const tokRes = await fetch("/api/call/signaling-token", {
    headers: getAuthHeaders(),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!tokRes.ok) {
    const errBody = await tokRes.json().catch(() => ({}));
    const apiErr = (errBody as { error?: string }).error?.trim();
    let msg = apiErr || "Token semnalizare respins.";
    if (tokRes.status === 401) {
      msg = apiErr || "Neautorizat la token semnalizare — ieși și intră din nou în cont.";
    } else if (tokRes.status === 503) {
      msg =
        apiErr ||
        "Semnalizare neconfigurată: pe server pune SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET (min 16), același secret ca pe procesul WS; procesul trebuie să ruleze pe NEXT_PUBLIC_SIGNALING_WS_URL.";
    } else if (include404TokenErrors && tokRes.status === 404) {
      msg = apiErr || "Utilizator negăsit pentru token semnalizare.";
    }
    const message =
      process.env.NODE_ENV === "development" ? `[${tokRes.status}] ${msg}` : msg;
    return { ok: false, status: tokRes.status, message };
  }
  const { token } = (await tokRes.json()) as { token?: string };
  if (!token) {
    return { ok: false, status: tokRes.status, message: "Token semnalizare lipsă." };
  }
  return { ok: true, token };
}

export type OpenSignalingWebSocketParams = {
  baseUrl: string;
  /** Token deja obținut de caller (mesaje / erori UI identice cu înainte). */
  initialToken: string;
  getAuthHeaders: SignalingGetAuthHeaders;
  cancelled: () => boolean;
  maxWsAttempts: number;
  /** `"mesh"` → log `[SIGNALING][mesh]`; altfel `[SIGNALING]` */
  logLabel: "mesh" | "p2p";
  /** Mesaj afișat când toate încercările de conectare WS au eșuat */
  finalConnectErrorMessage: string;
  /** Apelat când trebuie oprit streamul local înainte de return (ex. token invalid, anulare). */
  onAbortLocalStream?: () => void;
};

export type SignalingConnectResult =
  | { ok: true; ws: WebSocket }
  | { ok: false; reason: "cancelled" | "ws_exhausted" | "token_refresh_failed" };

/**
 * Buclă WebSocket + refresh token la reconnect — aceeași ordine ca în useWebRtcCall.
 */
export async function openSignalingWebSocketWithRetry(
  p: OpenSignalingWebSocketParams
): Promise<SignalingConnectResult> {
  const { baseUrl, initialToken, getAuthHeaders, cancelled, maxWsAttempts, logLabel, finalConnectErrorMessage } =
    p;
  const onAbort = p.onAbortLocalStream;
  const log = (m: string, extra?: unknown) => {
    const prefix = logLabel === "mesh" ? "[SIGNALING][mesh]" : "[SIGNALING]";
    if (extra !== undefined) console.info(prefix, m, extra);
    else console.info(prefix, m);
  };

  const base = baseUrl.trim();
  if (!base) return { ok: false, reason: "ws_exhausted" };

  let activeToken = initialToken;

  let ws: WebSocket | null = null;
  for (let attempt = 0; attempt < maxWsAttempts; attempt++) {
    if (cancelled()) {
      onAbort?.();
      return { ok: false, reason: "cancelled" };
    }
    if (attempt > 0) {
      pushCallDebug({
        kind: "signaling_reconnect",
        detail: { logLabel, attempt },
      });
      const delay = Math.min(4000, 400 * 2 ** (attempt - 1));
      log("WS reconnect scheduled", { attempt, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
      const tokRes2 = await fetchCallSignalingToken(getAuthHeaders, logLabel === "p2p");
      if (!tokRes2.ok) {
        return { ok: false, reason: "token_refresh_failed" };
      }
      activeToken = tokRes2.token;
    }
    const wsUrl = signalingWsConnectUrl(base, activeToken);
    try {
      const u = new URL(wsUrl);
      u.searchParams.set("token", "<redacted>");
      log("WS connecting", u.toString());
    } catch {
      log("WS connecting");
    }
    try {
      ws = await new Promise<WebSocket>((resolve, reject) => {
        const w = new WebSocket(wsUrl);
        const to = window.setTimeout(() => {
          try {
            w.close();
          } catch {
            /* ignore */
          }
          reject(new Error("WS open timeout"));
        }, 20_000);
        w.addEventListener(
          "open",
          () => {
            window.clearTimeout(to);
            log("WS connected");
            resolve(w);
          },
          { once: true }
        );
        w.addEventListener(
          "error",
          () => {
            window.clearTimeout(to);
            reject(new Error("ws error"));
          },
          { once: true }
        );
      });
      break;
    } catch (e) {
      console.warn(logLabel === "mesh" ? "[SIGNALING][mesh]" : "[SIGNALING]", "WS connect failed", attempt + 1, e);
      ws = null;
      if (attempt === maxWsAttempts - 1) {
        console.warn(finalConnectErrorMessage);
        pushCallDebug({
          kind: "signaling_ws_failed",
          detail: { logLabel, reason: "ws_exhausted" },
        });
        return { ok: false, reason: "ws_exhausted" };
      }
    }
  }
  if (ws) return { ok: true, ws };
  return { ok: false, reason: "token_refresh_failed" };
}
