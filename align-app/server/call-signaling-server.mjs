#!/usr/bin/env node
/**
 * Server WebSocket dedicat pentru semnalizare WebRTC (Next.js serverless nu ține WS).
 * Rulează pe Hetzner lângă coturn; în dev: `npm run signaling:dev`
 *
 * Env: SIGNALING_TOKEN_SECRET (sau NEXTAUTH_SECRET), SIGNALING_PORT (default 4001), NODE_ENV
 * Opțional: SIGNALING_MAX_CONN_PER_IP, SIGNALING_MSG_BURST_PER_10S, SIGNALING_MAX_MSG_BYTES, SIGNALING_HEARTBEAT_TTL_MS
 */
import { WebSocketServer } from "ws";
import { createServer } from "http";
import crypto from "crypto";

const PORT = Number(process.env.SIGNALING_PORT || 4001);
const SECRET = process.env.SIGNALING_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || "";
const IS_PROD = process.env.NODE_ENV === "production";
const MAX_CONN_PER_IP = Number(process.env.SIGNALING_MAX_CONN_PER_IP || 40);
const MSG_BURST = Number(process.env.SIGNALING_MSG_BURST_PER_10S || 100);
const MAX_MSG_BYTES = Number(process.env.SIGNALING_MAX_MSG_BYTES || 65536);
const HEARTBEAT_TTL_MS = Number(process.env.SIGNALING_HEARTBEAT_TTL_MS || 75_000);

function logWarn(msg) {
  if (IS_PROD) console.warn(`[signaling] ${msg}`);
  else console.warn(`[signaling] ${msg}`);
}

function logErr(msg) {
  console.error(`[signaling] ${msg}`);
}

if (!SECRET || SECRET.length < 16) {
  logErr("Lipsește SIGNALING_TOKEN_SECRET sau NEXTAUTH_SECRET (min 16 caractere).");
  process.exit(1);
}

function b64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function verifyToken(token) {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = b64url(crypto.createHmac("sha256", SECRET).update(body).digest());
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** @type {Map<string, Map<string, { ws: import('ws').WebSocket, userId: string, isCaller: boolean, heartbeat: number }>>} */
const rooms = new Map();

function roomKey(roomId) {
  return roomId;
}

function safeRoomId(roomId) {
  return typeof roomId === "string" && roomId.startsWith("align-") && roomId.length < 200;
}

function getRoom(roomId) {
  let r = rooms.get(roomKey(roomId));
  if (!r) {
    r = new Map();
    rooms.set(roomKey(roomId), r);
  }
  return r;
}

function removeFromAllRooms(userId, ws) {
  for (const [rid, clients] of rooms.entries()) {
    const c = clients.get(userId);
    if (c?.ws === ws) {
      clients.delete(userId);
      if (clients.size === 0) rooms.delete(rid);
    }
  }
}

function broadcastSession(roomId) {
  const clients = rooms.get(roomKey(roomId));
  if (!clients || clients.size < 2) return;
  if (clients.size > 2) {
    const entries = [...clients.entries()];
    for (const [uid, c] of entries.slice(2)) {
      clients.delete(uid);
      try {
        c.ws.close(4002, "Room full (max 2 for P2P)");
      } catch {}
    }
  }
  const arr = [...clients.values()];
  if (arr.length !== 2) return;
  const [a, b] = arr;
  function shouldOffer(client, peer) {
    if (client.isCaller && !peer.isCaller) return true;
    if (!client.isCaller && peer.isCaller) return false;
    return client.userId < peer.userId;
  }
  const offerA = shouldOffer(a, b);
  const offerB = shouldOffer(b, a);
  const msgA = JSON.stringify({
    t: "session",
    remoteUserId: b.userId,
    shouldOffer: offerA,
  });
  const msgB = JSON.stringify({
    t: "session",
    remoteUserId: a.userId,
    shouldOffer: offerB,
  });
  if (a.ws.readyState === 1) a.ws.send(msgA);
  if (b.ws.readyState === 1) b.ws.send(msgB);
}

function relay(roomId, fromUserId, raw) {
  const clients = rooms.get(roomKey(roomId));
  if (!clients) return;
  for (const [uid, c] of clients.entries()) {
    if (uid === fromUserId) continue;
    if (c.ws.readyState === 1) c.ws.send(raw);
  }
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) {
    return xf.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

const ipConnCount = new Map();

function incIp(ip) {
  const n = (ipConnCount.get(ip) || 0) + 1;
  ipConnCount.set(ip, n);
  return n;
}

function decIp(ip) {
  const n = Math.max(0, (ipConnCount.get(ip) || 1) - 1);
  if (n === 0) ipConnCount.delete(ip);
  else ipConnCount.set(ip, n);
}

const server = createServer((req, res) => {
  if (req.url === "/health" || req.url?.startsWith("/health?")) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const ip = clientIp(req);
  if (incIp(ip) > MAX_CONN_PER_IP) {
    decIp(ip);
    try {
      ws.close(4403, "Too many connections");
    } catch {}
    if (!IS_PROD) logWarn(`reject connection: IP limit ${ip}`);
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token") || "";
  const payload = verifyToken(token);
  if (!payload) {
    decIp(ip);
    ws.close(4401, "Unauthorized");
    return;
  }
  const userId = payload.sub;
  let currentRoom = null;
  /** @type {number[]} */
  const msgTimestamps = [];

  ws.on("message", (data, isBinary) => {
    if (isBinary) return;
    const len = typeof data === "string" ? Buffer.byteLength(data) : data.length;
    if (len > MAX_MSG_BYTES) {
      try {
        ws.close(4409, "Message too large");
      } catch {}
      return;
    }
    const now = Date.now();
    const windowStart = now - 10_000;
    while (msgTimestamps.length && msgTimestamps[0] < windowStart) msgTimestamps.shift();
    if (msgTimestamps.length >= MSG_BURST) {
      return;
    }
    msgTimestamps.push(now);

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;

    if (msg.t === "heartbeat" || msg.t === "ping") {
      const c = currentRoom && rooms.get(roomKey(currentRoom))?.get(userId);
      if (c) c.heartbeat = Date.now();
      ws.send(JSON.stringify({ t: "pong" }));
      return;
    }

    if (msg.t === "join") {
      if (!safeRoomId(msg.roomId)) {
        ws.send(JSON.stringify({ t: "error", code: "BAD_ROOM" }));
        return;
      }
      removeFromAllRooms(userId, ws);
      currentRoom = msg.roomId;
      const r = getRoom(msg.roomId);
      if (r.size >= 2 && !r.has(userId)) {
        ws.send(JSON.stringify({ t: "error", code: "ROOM_FULL" }));
        ws.close(4002, "Room full");
        return;
      }
      r.set(userId, {
        ws,
        userId,
        isCaller: Boolean(msg.isCaller),
        heartbeat: Date.now(),
      });
      ws.send(JSON.stringify({ t: "joined", roomId: msg.roomId, peers: [...r.keys()] }));
      broadcastSession(msg.roomId);
      return;
    }

    if (!currentRoom || !safeRoomId(currentRoom)) return;

    if (["offer", "answer", "ice", "call-end"].includes(msg.t)) {
      const line = JSON.stringify({ ...msg, from: userId });
      relay(currentRoom, userId, line);
    }
  });

  ws.on("close", () => {
    decIp(ip);
    if (currentRoom) {
      const r = rooms.get(roomKey(currentRoom));
      if (r) {
        r.delete(userId);
        relay(currentRoom, userId, JSON.stringify({ t: "call-end", from: userId }));
        if (r.size === 0) rooms.delete(roomKey(currentRoom));
      }
    }
    removeFromAllRooms(userId, ws);
  });
});

setInterval(() => {
  const now = Date.now();
  const ttl = HEARTBEAT_TTL_MS;
  for (const [rid, clients] of rooms.entries()) {
    for (const [uid, c] of clients.entries()) {
      if (now - c.heartbeat > ttl) {
        try {
          c.ws.close(4408, "Heartbeat timeout");
        } catch {}
        clients.delete(uid);
      }
    }
    if (clients.size === 0) rooms.delete(rid);
  }
}, 30_000);

server.listen(PORT, () => {
  if (!IS_PROD) {
    logWarn(`WS pe ws://localhost:${PORT}/ws (dev) — folosește http:// în browser, nu https:// către Next dev`);
  } else {
    logWarn(`WS pornit pe port ${PORT} (TLS la reverse proxy: wss://ws.diebel.ro → 127.0.0.1:${PORT}/ws)`);
  }
});
