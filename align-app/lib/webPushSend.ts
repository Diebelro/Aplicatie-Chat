/**
 * Trimite notificare Web Push (Push API) — doar date; click deschide apelul în tab.
 * Nu rulează WebRTC aici și nici în Service Worker.
 */

import { getPublicAppUrl } from "@/lib/appUrl";
import { prismaDeleteWebPushSubscription, prismaListWebPushSubscriptionsForUser } from "@/lib/repo-prisma";
import { getVapidPrivateKey, getVapidPublicKey, getVapidSubject } from "@/lib/webPushEnv";

export type IncomingCallWebPushPayload = {
  roomId: string;
  callerId: string;
  callerName: string;
  audioOnly: boolean;
};

export async function sendIncomingCallWebPush(
  calleeUserId: string,
  data: IncomingCallWebPushPayload
): Promise<{ sent: number; failed: number }> {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[webPushSend] VAPID neconfigurat");
    }
    return { sent: 0, failed: 0 };
  }

  const subs = await prismaListWebPushSubscriptionsForUser(calleeUserId);
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const webpush = await import("web-push");
  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);

  const base = getPublicAppUrl();
  const openUrl = `${base}/app/call/${encodeURIComponent(data.roomId)}?from=push&audio=${data.audioOnly ? "1" : "0"}`;
  const title = `${data.callerName.slice(0, 80)} te sună`;
  const body = data.audioOnly ? "Apel audio" : "Apel video";
  const payload = JSON.stringify({
    type: "incoming_call",
    title,
    body,
    openUrl,
    roomId: data.roomId,
    callerId: data.callerId,
    callerName: data.callerName.slice(0, 120),
    callType: data.audioOnly ? "audio" : "video",
    ts: Date.now(),
  });

  let sent = 0;
  let failed = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        payload,
        { TTL: 60, urgency: "high" }
      );
      sent++;
    } catch (e: unknown) {
      failed++;
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await prismaDeleteWebPushSubscription(s.endpoint);
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[webPushSend]", status ?? e);
      }
    }
  }
  return { sent, failed };
}
