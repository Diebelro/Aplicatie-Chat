import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPendingCall } from "@/lib/store";
import { findUserOrPrisma } from "@/lib/repo-prisma";

/** Placeholder: verifică apel în așteptare (fără WebRTC/video real). */
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const user = await findUserOrPrisma(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const pending = getPendingCall(userId);
  if (!pending) {
    return NextResponse.json({ incoming: null });
  }
  const fromUser = await findUserOrPrisma(pending.fromId);
  return NextResponse.json({
    incoming: {
      fromId: pending.fromId,
      fromName: fromUser?.name ?? "Cineva",
      roomId: pending.roomId,
      audioOnly: pending.audioOnly,
    },
  });
}
