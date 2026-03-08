import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPendingCall, clearPendingCall } from "@/lib/store";

/** Accept the call (callee). Same as /api/call/answer. Returns roomId and audioOnly for redirect. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const pending = getPendingCall(userId);
  if (!pending) {
    return NextResponse.json({ error: "No incoming call." }, { status: 404 });
  }
  clearPendingCall(userId);
  return NextResponse.json({
    roomId: pending.roomId,
    audioOnly: pending.audioOnly,
  });
}
