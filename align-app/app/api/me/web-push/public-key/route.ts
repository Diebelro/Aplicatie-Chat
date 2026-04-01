import { NextResponse } from "next/server";
import { getVapidPublicKeyForClient, isWebPushConfigured } from "@/lib/webPushEnv";

export const dynamic = "force-dynamic";

/** Cheie publică VAPID pentru `pushManager.subscribe` (client). */
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ configured: false, publicKey: null }, { status: 200 });
  }
  return NextResponse.json({ configured: true, publicKey: getVapidPublicKeyForClient() ?? null });
}
