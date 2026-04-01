import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaDeleteWebPushIfOwned,
  prismaUpsertWebPushSubscription,
} from "@/lib/repo-prisma";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { isWebPushConfigured } from "@/lib/webPushEnv";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
  expirationTime: z.nullable(z.number()).optional(),
});

/** Salvează abonament Push API (VAPID). Body = `PushSubscription.toJSON()`. */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push neconfigurat pe server." }, { status: 503 });
  }
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Baza de date indisponibilă." }, { status: 503 });
  }
  if (!rateLimitAllow(`webpush-sub:${userId}`, 40, 60_000)) {
    return NextResponse.json({ error: "Prea multe cereri." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalid." }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Abonament invalid." }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  try {
    await prismaUpsertWebPushSubscription(userId, endpoint, keys.p256dh, keys.auth);
  } catch (e) {
    console.error("[api/me/web-push/subscribe]", e);
    return NextResponse.json({ error: "Nu s-a putut salva." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Body: `{ endpoint }` */
export async function DELETE(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Baza de date indisponibilă." }, { status: 503 });
  }

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalid." }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Lipsește endpoint." }, { status: 400 });
  }

  await prismaDeleteWebPushIfOwned(userId, endpoint);
  return NextResponse.json({ ok: true });
}
