import { NextRequest, NextResponse } from "next/server";
import { setPendingCall } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";
import { findUserOrPrisma, isPrismaAvailable, prismaUpsertPendingIncomingCall } from "@/lib/repo-prisma";
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

  const me = await findUserOrPrisma(userId);
  if (!me) {
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
  const roomId = body.roomId ?? getVideoRoomId(me.id, toId);
  const audioOnly = Boolean(body.audioOnly);
  const other = await findUserOrPrisma(toId);
  if (!other) {
    return NextResponse.json({ error: "Utilizatorul sunat nu există." }, { status: 404 });
  }
  setPendingCall(toId, { fromId: me.id, roomId, audioOnly });
  if (isPrismaAvailable()) {
    try {
      await prismaUpsertPendingIncomingCall(toId, me.id, roomId, audioOnly);
    } catch (e) {
      console.error("[api/call/ring] prismaUpsertPendingIncomingCall", e);
    }
  }
  return NextResponse.json({ ok: true, roomId });
}
