import { NextRequest, NextResponse } from "next/server";
import { findUserOrPrisma, prismaUserRowExists, isPrismaAvailable } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { getPendingIncomingForCallee } from "@/lib/callPending";
import { findUserById } from "@/lib/store";

/** Poll: apel în așteptare pentru utilizatorul curent (callee). */
export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const user = await findUserOrPrisma(userId);
  const exists =
    user != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!exists) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const pending = await getPendingIncomingForCallee(userId);
  if (!pending) {
    return NextResponse.json({ incoming: null });
  }
  const fromUser = await findUserOrPrisma(pending.fromId);
  return NextResponse.json({
    incoming: {
      fromId: pending.fromId,
      fromName: fromUser?.name ?? fromUser?.username ?? "Cineva",
      roomId: pending.roomId,
      audioOnly: pending.audioOnly,
    },
  });
}
