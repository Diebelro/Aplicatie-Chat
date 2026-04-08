/**
 * Trimitere FCM data-only (high priority) pentru apel primit — declanșator principal pe Android nativ.
 * Fără payload notification body → nu înlocuiește UI de sistem; native layer afișează ConnectionService.
 *
 * Env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (sau GOOGLE_APPLICATION_CREDENTIALS JSON path).
 */

import type { App } from "firebase-admin/app";
import type { Messaging } from "firebase-admin/messaging";
import { normalizeMultilineEnv } from "@/lib/env/normalizeMultilineEnv";

let adminApp: App | null = null;
let messaging: Messaging | null = null;

function getPrivateKey(): string {
  return normalizeMultilineEnv(process.env.FIREBASE_PRIVATE_KEY);
}

export function isFcmConfigured(): boolean {
  const pid = process.env.FIREBASE_PROJECT_ID?.trim();
  const email = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const key = getPrivateKey();
  return Boolean(pid && email && key.length > 0);
}

async function getMessaging(): Promise<Messaging | null> {
  if (!isFcmConfigured()) return null;
  if (messaging) return messaging;
  const admin = await import("firebase-admin/app");
  const { getMessaging: gm } = await import("firebase-admin/messaging");
  if (!admin.getApps().length) {
    adminApp = admin.initializeApp({
      credential: admin.cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: getPrivateKey(),
      }),
    });
  } else {
    adminApp = admin.getApps()[0]!;
  }
  messaging = gm(adminApp);
  return messaging;
}

export type IncomingCallPushPayload = {
  calleeUserId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  audioOnly: boolean;
};

/** Trimite către toate token-urile înregistrate pentru user; ignori erori per-token (expirate). */
export async function sendIncomingCallDataPush(
  tokens: string[],
  data: Omit<IncomingCallPushPayload, "calleeUserId">
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };
  const msgSvc = await getMessaging();
  if (!msgSvc) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[fcmCallPush] FCM neconfigurată — setează FIREBASE_* env");
    }
    return { sent: 0, failed: tokens.length };
  }

  let sent = 0;
  let failed = 0;
  const baseData = {
    type: "incoming_call",
    roomId: data.roomId,
    callerId: data.callerId,
    callerName: data.callerName.slice(0, 120),
    audioOnly: data.audioOnly ? "1" : "0",
    ts: String(Date.now()),
  };

  for (const token of tokens) {
    try {
      await msgSvc.send({
        token,
        data: baseData,
        android: { priority: "high" },
      });
      sent++;
    } catch (e) {
      failed++;
      const code = (e as { code?: string })?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        const { prismaDeletePushDeviceByToken } = await import("@/lib/repo-prisma");
        await prismaDeletePushDeviceByToken(token).catch(() => {});
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[fcmCallPush] send failed", code ?? e);
      }
    }
  }
  return { sent, failed };
}
