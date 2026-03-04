import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPendingCall, clearPendingCall, addRejectedRoom } from "@/lib/store";

/** Reject the call (callee). Notifies caller via rejected room so they see "Call rejected". */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const pending = getPendingCall(userId);
  if (pending) addRejectedRoom(pending.roomId);
  clearPendingCall(userId);
  return NextResponse.json({ ok: true });
}
