import { NextRequest, NextResponse } from "next/server";
import { findUserById, addRejectedRoom } from "@/lib/store";
import { findUserOrPrisma, prismaUserRowExists, isPrismaAvailable } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { getPendingIncomingForCallee, clearPendingIncomingForCallee } from "@/lib/callPending";

/** Reject the call (callee). Caller will see "Call rejected" when they poll outgoing-status. */
export async function POST(request: NextRequest) {
  const userId = resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const okUser =
    (await findUserOrPrisma(userId)) != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!okUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const pending = await getPendingIncomingForCallee(userId);
  if (pending) addRejectedRoom(pending.roomId);
  await clearPendingIncomingForCallee(userId);
  return NextResponse.json({ ok: true });
}
