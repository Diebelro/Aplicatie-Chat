import { NextRequest, NextResponse } from "next/server";
import { findUserById, markAnsweredCallRoom } from "@/lib/store";
import {
  findUserOrPrisma,
  prismaUserRowExists,
  isPrismaAvailable,
  prismaMarkAnsweredCallRoom,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { getPendingIncomingForCallee, clearPendingIncomingForCallee } from "@/lib/callPending";

/** Răspunde la apel: șterge apelul în așteptare și returnează roomId pentru redirect. */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const okUser =
    (await findUserOrPrisma(userId)) != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!okUser) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const pending = await getPendingIncomingForCallee(userId);
  if (!pending) {
    return NextResponse.json({ error: "Nu ai niciun apel în așteptare." }, { status: 404 });
  }
  const rid = pending.roomId;
  markAnsweredCallRoom(rid);
  if (isPrismaAvailable()) await prismaMarkAnsweredCallRoom(rid);
  await clearPendingIncomingForCallee(userId);
  return NextResponse.json({
    roomId: rid,
    audioOnly: pending.audioOnly,
  });
}
