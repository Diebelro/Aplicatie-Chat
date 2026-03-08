import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPendingCall, clearPendingCall } from "@/lib/store";

/** Răspunde la apel: șterge apelul în așteptare și returnează roomId pentru redirect. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const pending = getPendingCall(userId);
  if (!pending) {
    return NextResponse.json({ error: "Nu ai niciun apel în așteptare." }, { status: 404 });
  }
  clearPendingCall(userId);
  return NextResponse.json({
    roomId: pending.roomId,
    audioOnly: pending.audioOnly,
  });
}
