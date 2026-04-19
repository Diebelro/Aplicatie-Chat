import { NextRequest, NextResponse } from "next/server";
import { findUserById, addRejectedRoom, clearAnsweredCallRoom } from "@/lib/store";
import {
  findUserOrPrisma,
  prismaMarkCallRejectedRoom,
  prismaUserRowExists,
  isPrismaAvailable,
  prismaClearAnsweredCallRoom,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { getPendingIncomingForCallee, clearPendingIncomingForCallee } from "@/lib/callPending";
import { callApiErrorJson } from "@/lib/call/callApiJsonError";

/** Reject the call (callee). Caller will see "Call rejected" when they poll outgoing-status. */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json(
      callApiErrorJson("SIGNALING_TOKEN_INVALID", { error: "Unauthorized." }),
      { status: 401 }
    );
  }
  const okUser =
    (await findUserOrPrisma(userId)) != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!okUser) {
    return NextResponse.json(callApiErrorJson("UNKNOWN", { error: "User not found." }), { status: 404 });
  }
  const pending = await getPendingIncomingForCallee(userId);
  if (pending) {
    const rid = pending.roomId;
    clearAnsweredCallRoom(rid);
    if (isPrismaAvailable()) await prismaClearAnsweredCallRoom(rid);
    addRejectedRoom(rid);
    if (isPrismaAvailable()) await prismaMarkCallRejectedRoom(rid);
  }
  await clearPendingIncomingForCallee(userId);
  return NextResponse.json({ ok: true });
}
