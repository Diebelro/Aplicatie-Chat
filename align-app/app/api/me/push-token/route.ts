import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaDeletePushDeviceIfOwned,
  prismaUpsertFcmPushDevice,
  prismaUpsertVoipPushDevice,
} from "@/lib/repo-prisma";
import { rateLimitAllow } from "@/lib/callRateLimit";

export const dynamic = "force-dynamic";

const TOKEN_MAX = 512;

/**
 * POST: înregistrează push pentru apeluri native.
 * - FCM (Android): `{ "token": "...", "platform": "android" }` sau `{ "fcmToken": "..." }`
 * - VoIP PushKit (iOS): `{ "apnsVoipToken": "...", "platform": "ios" }`
 */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Baza de date indisponibilă." }, { status: 503 });
  }
  if (!rateLimitAllow(`push-reg:${userId}`, 30, 60_000)) {
    return NextResponse.json({ error: "Prea multe cereri." }, { status: 429 });
  }

  let body: {
    token?: string;
    fcmToken?: string;
    apnsVoipToken?: string;
    platform?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalid." }, { status: 400 });
  }

  const voip =
    typeof body.apnsVoipToken === "string" ? body.apnsVoipToken.trim() : "";
  const fcm =
    (typeof body.fcmToken === "string" ? body.fcmToken.trim() : "") ||
    (typeof body.token === "string" ? body.token.trim() : "");
  const platform =
    typeof body.platform === "string" && body.platform.length <= 16 ? body.platform : "";

  try {
    if (voip) {
      if (voip.length > TOKEN_MAX) {
        return NextResponse.json({ error: "Token VoIP invalid." }, { status: 400 });
      }
      await prismaUpsertVoipPushDevice(userId, voip);
    } else if (fcm) {
      if (fcm.length > TOKEN_MAX) {
        return NextResponse.json({ error: "Token invalid." }, { status: 400 });
      }
      const plat = platform || "android";
      await prismaUpsertFcmPushDevice(userId, fcm, plat);
    } else {
      return NextResponse.json(
        { error: "Lipsește fcmToken, token sau apnsVoipToken." },
        { status: 400 }
      );
    }
  } catch (e) {
    console.error("[api/me/push-token] upsert", e);
    return NextResponse.json({ error: "Nu s-a putut salva tokenul." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE: body `{ "token": "...", "kind": "fcm" | "voip" }` — implicit fcm */
export async function DELETE(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Baza de date indisponibilă." }, { status: 503 });
  }

  let body: { token?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalid." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Lipsește token." }, { status: 400 });
  }
  const kind = body.kind === "voip" ? "voip" : "fcm";
  await prismaDeletePushDeviceIfOwned(userId, token, kind);
  return NextResponse.json({ ok: true });
}
