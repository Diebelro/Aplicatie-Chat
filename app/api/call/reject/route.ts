import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPendingCall, clearPendingCall, addRejectedRoom } from "@/lib/store";

/** Reject the call (callee). Caller will see "Call rejected" when they poll outgoing-status. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const pending = getPendingCall(userId);
  if (pending) addRejectedRoom(pending.roomId);
  clearPendingCall(userId);
  return NextResponse.json({ ok: true });
}
