import { NextRequest, NextResponse } from "next/server";
import { setPendingCall } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";
import {
  isPrismaAvailable,
  prismaListFcmTokensForUser,
  prismaListVoipTokensForUser,
  prismaListWebPushSubscriptionsForUser,
  prismaUpsertPendingIncomingCall,
} from "@/lib/repo-prisma";
import { callApiCallerUserExists, resolveUserDtoForRing } from "@/lib/callCallerExists";
import { isApnsVoipConfigured, sendIncomingCallVoipPush } from "@/lib/apnsVoipPush";
import { isFcmConfigured, sendIncomingCallDataPush } from "@/lib/fcmCallPush";
import { isWebPushConfigured } from "@/lib/webPushEnv";
import { sendIncomingCallWebPush } from "@/lib/webPushSend";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { resolveRequestUserId } from "@/lib/sessionAuth";

/** Sună pe toId: înregistrează apelul în așteptare ca celălalt să vadă „X te sună”. */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  if (!rateLimitAllow(`call-ring:${userId}`, 5, 60_000)) {
    return NextResponse.json({ error: "Prea multe apeluri. Încearcă mai târziu." }, { status: 429 });
  }

  if (!(await callApiCallerUserExists(userId))) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }

  let body: { toId?: string; roomId?: string; audioOnly?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalid." }, { status: 400 });
  }
  const toId = body.toId;
  if (!toId || typeof toId !== "string") {
    return NextResponse.json({ error: "Lipsește toId." }, { status: 400 });
  }
  const me = await resolveUserDtoForRing(userId);
  if (!me) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  if (!(await callApiCallerUserExists(toId))) {
    return NextResponse.json({ error: "Utilizatorul sunat nu există." }, { status: 404 });
  }

  const roomId = body.roomId ?? getVideoRoomId(me.id, toId);
  const audioOnly = Boolean(body.audioOnly);
  setPendingCall(toId, { fromId: me.id, roomId, audioOnly });
  let notify:
    | {
        prisma: boolean;
        fcm: { server: boolean; calleeDevices: number };
        voip: { server: boolean; calleeDevices: number };
        webPush: { server: boolean; calleeSubscriptions: number };
      }
    | undefined;

  if (isPrismaAvailable()) {
    try {
      await prismaUpsertPendingIncomingCall(toId, me.id, roomId, audioOnly);
    } catch (e) {
      console.error("[api/call/ring] prismaUpsertPendingIncomingCall", e);
    }
  }

  /** Android: FCM. iOS: APNs VoIP. Browser: Web Push (VAPID) + fallback la poll /api/call/incoming. */
  if (isPrismaAvailable()) {
    const callerName = me.name ?? me.username ?? "Apel";
    const pushData = { roomId, callerId: me.id, callerName, audioOnly };
    const fcmServer = isFcmConfigured();
    const voipServer = isApnsVoipConfigured();
    const webServer = isWebPushConfigured();
    let fcmCallee = 0;
    let voipCallee = 0;
    let webCallee = 0;
    if (fcmServer) {
      try {
        const tokens = await prismaListFcmTokensForUser(toId);
        fcmCallee = tokens.length;
        void sendIncomingCallDataPush(tokens, pushData);
      } catch (e) {
        console.error("[api/call/ring] FCM push", e);
      }
    }
    if (voipServer) {
      try {
        const voipTokens = await prismaListVoipTokensForUser(toId);
        voipCallee = voipTokens.length;
        void sendIncomingCallVoipPush(voipTokens, pushData);
      } catch (e) {
        console.error("[api/call/ring] APNs VoIP push", e);
      }
    }
    if (webServer) {
      try {
        const subs = await prismaListWebPushSubscriptionsForUser(toId);
        webCallee = subs.length;
        void sendIncomingCallWebPush(toId, pushData);
      } catch (e) {
        console.error("[api/call/ring] Web Push", e);
      }
    }
    notify = {
      prisma: true,
      fcm: { server: fcmServer, calleeDevices: fcmCallee },
      voip: { server: voipServer, calleeDevices: voipCallee },
      webPush: { server: webServer, calleeSubscriptions: webCallee },
    };
  } else {
    notify = {
      prisma: false,
      fcm: { server: false, calleeDevices: 0 },
      voip: { server: false, calleeDevices: 0 },
      webPush: { server: false, calleeSubscriptions: 0 },
    };
  }

  return NextResponse.json({ ok: true, roomId, notify });
}
