/**
 * APNs HTTP/2 — PushKit VoIP (`apns-push-type: voip`, topic `{bundleId}.voip`).
 * Declanșator apel iOS nativ (fără polling, fără WebKit).
 *
 * Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (.p8, newline ca \n), APNS_BUNDLE_ID,
 *      APNS_USE_SANDBOX=true pentru development builds iOS.
 */

import http2 from "node:http2";
import jwt from "jsonwebtoken";

function apnsPrivateKey(): string {
  return (process.env.APNS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

export function isApnsVoipConfigured(): boolean {
  const kid = process.env.APNS_KEY_ID?.trim();
  const iss = process.env.APNS_TEAM_ID?.trim();
  const key = apnsPrivateKey();
  const bundle = process.env.APNS_BUNDLE_ID?.trim();
  return Boolean(kid && iss && key.length > 0 && bundle);
}

function buildApnsJwt(): string {
  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  const key = apnsPrivateKey();
  return jwt.sign(
    { iss: teamId, iat: Math.floor(Date.now() / 1000) },
    key,
    {
      algorithm: "ES256",
      header: { alg: "ES256", kid: keyId },
      noTimestamp: true,
    }
  );
}

export type IncomingCallVoipPayload = {
  roomId: string;
  callerId: string;
  callerName: string;
  audioOnly: boolean;
};

/**
 * Trimite un VoIP push; payload conține date pentru CallKit + WebRTC după Accept.
 */
export async function sendIncomingCallVoipPush(
  deviceTokens: string[],
  data: IncomingCallVoipPayload
): Promise<{ sent: number; failed: number }> {
  if (deviceTokens.length === 0) return { sent: 0, failed: 0 };
  if (!isApnsVoipConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[apnsVoipPush] APNs neconfigurat — setează APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID");
    }
    return { sent: 0, failed: deviceTokens.length };
  }

  const bundle = process.env.APNS_BUNDLE_ID!.replace(/\.+$/, "");
  const sandbox = process.env.APNS_USE_SANDBOX === "true";
  const host = sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const topic = `${bundle}.voip`;

  const bodyObj = {
    aps: {
      "content-available": 1,
    },
    type: "incoming_call",
    roomId: data.roomId,
    callerId: data.callerId,
    callerName: data.callerName.slice(0, 120),
    audioOnly: data.audioOnly ? "1" : "0",
    ts: String(Date.now()),
  };
  const body = JSON.stringify(bodyObj);

  let sent = 0;
  let failed = 0;

  for (const rawTok of deviceTokens) {
    const deviceToken = rawTok.replace(/\s/g, "");
    if (!deviceToken) {
      failed++;
      continue;
    }
    const status = await sendVoipToDevice(host, topic, deviceToken, body);
    if (status >= 200 && status < 300) {
      sent++;
    } else {
      failed++;
      if (status === 410 || status === 400) {
        const { prismaDeletePushDeviceByVoipToken } = await import("@/lib/repo-prisma");
        await prismaDeletePushDeviceByVoipToken(deviceToken).catch(() => {});
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[apnsVoipPush] status", status, deviceToken.slice(0, 8));
      }
    }
  }

  return { sent, failed };
}

function sendVoipToDevice(host: string, topic: string, deviceToken: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const client = http2.connect(`https://${host}`);

    const finish = (status: number) => {
      if (resolved) return;
      resolved = true;
      try {
        client.close();
      } catch {
        /* ignore */
      }
      resolve(status);
    };

    client.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    let auth: string;
    try {
      auth = buildApnsJwt();
    } catch (e) {
      client.close();
      reject(e);
      return;
    }

    const path = `/3/device/${deviceToken}`;
    const headers: http2.OutgoingHttpHeaders = {
      ":method": "POST",
      ":path": path,
      authorization: `bearer ${auth}`,
      "apns-topic": topic,
      "apns-push-type": "voip",
      "apns-priority": "10",
      "apns-expiration": "0",
      "content-type": "application/json",
    };

    const req = client.request(headers);
    let statusCode = 500;

    req.on("response", (headers) => {
      const s = headers[":status"];
      statusCode = typeof s === "string" ? parseInt(s, 10) : Number(s ?? 500);
    });

    let respBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      respBody += chunk;
    });

    req.on("end", () => {
      if (statusCode >= 400 && process.env.NODE_ENV !== "production" && respBody) {
        console.warn("[apnsVoipPush] body", respBody.slice(0, 200));
      }
      finish(statusCode);
    });

    req.on("error", () => finish(599));
    req.write(body);
    req.end();
  });
}
