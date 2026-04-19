import { NextRequest, NextResponse } from "next/server";
import { findUserById, clearAnsweredCallRoom } from "@/lib/store";
import {
  findUserOrPrisma,
  prismaUserRowExists,
  isPrismaAvailable,
  prismaClearAnsweredCallRoom,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { clearPendingIncomingForCallee, clearPendingIncomingForRoom } from "@/lib/callPending";
import { canAccessRoom } from "@/lib/videoCall";
import { callApiErrorJson } from "@/lib/call/callApiJsonError";

/** Încheie apelul: curăță pending pentru tine și, dacă trimiți roomId valid, pentru întreg apelul (nu mai „sună” la celălalt). */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_TOKEN_INVALID", { error: "Neautorizat." }),
      { status: 401 }
    );
  }
  const okUser =
    (await findUserOrPrisma(userId)) != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!okUser) {
    return NextResponse.json(callApiErrorJson("UNKNOWN", { error: "Utilizator negăsit." }), { status: 404 });
  }
  let body: { roomId?: string; recordMissedForCallee?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* fără corp e ok */
  }
  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const recordMissedForCallee = body.recordMissedForCallee === true;
  if (roomId && canAccessRoom(roomId, userId)) {
    await clearPendingIncomingForRoom(roomId, {
      endedByUserId: userId,
      recordMissedIfCaller: recordMissedForCallee,
    });
    clearAnsweredCallRoom(roomId);
    if (isPrismaAvailable()) await prismaClearAnsweredCallRoom(roomId);
  }
  await clearPendingIncomingForCallee(userId);
  return NextResponse.json({ ok: true });
}
