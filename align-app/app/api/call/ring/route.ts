import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/store";
import { setPendingCall } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";

/** Sună pe toId: înregistrează apelul în așteptare ca celălalt să vadă „X te sună” și să poată răspunde/respinge. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const me = findUserById(userId);
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
  const other = findUserById(toId);
  if (!other) {
    return NextResponse.json({ error: "Utilizatorul sunat nu există." }, { status: 404 });
  }
  setPendingCall(toId, { fromId: me.id, roomId, audioOnly });
  return NextResponse.json({ ok: true, roomId });
}
