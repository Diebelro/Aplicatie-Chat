import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isRoomRejected, isRoomCallAnswered } from "@/lib/store";
import {
  isPrismaAvailable,
  prismaIsCallRejectedRoom,
  prismaIsCallAnsweredRoom,
} from "@/lib/repo-prisma";
import { callApiCallerUserExists } from "@/lib/callCallerExists";
import { getPendingIncomingForCallee } from "@/lib/callPending";
import { parseVideoRoomId } from "@/lib/videoCall";

/**
 * Apelantul (caller) întreabă starea apelului 1-la-1:
 * - `ringing` — încă sună sau apelul tocmai a fost acceptat (conectare în curs).
 * - `rejected` — celălalt a apăsat explicit Respinge (sau echivalent API decline/reject).
 * - `unreachable` — nu mai sună și nu e respins explicit (offline, tab închis, apel anulat, expirat etc.).
 */
export async function GET(request: NextRequest) {
  let userId = await getAuthenticatedUserId(request);
  if (!userId) {
    userId = request.headers.get("x-user-id")?.trim() || null;
  }
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!(await callApiCallerUserExists(userId))) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const roomId = request.nextUrl.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "Lipsește roomId." }, { status: 400 });
  }

  const rejectedInMem = isRoomRejected(roomId);
  const rejectedInDb = isPrismaAvailable() && (await prismaIsCallRejectedRoom(roomId));
  const rejected = rejectedInMem || rejectedInDb;

  const answeredInMem = isRoomCallAnswered(roomId);
  const answeredInDb = isPrismaAvailable() && (await prismaIsCallAnsweredRoom(roomId));
  const answered = answeredInMem || answeredInDb;

  const pair = parseVideoRoomId(roomId);
  if (pair) {
    const [a, b] = pair;
    if (a !== userId && b !== userId) {
      return NextResponse.json({ error: "Nu ai acces la acest roomId." }, { status: 403 });
    }
    const calleeId = a === userId ? b : a;
    const pending = await getPendingIncomingForCallee(calleeId);
    const stillRinging =
      pending != null && pending.roomId === roomId && pending.fromId === userId;

    if (stillRinging || answered) {
      return NextResponse.json({ status: "ringing" });
    }
    if (rejected) {
      return NextResponse.json({ status: "rejected" });
    }
    return NextResponse.json({ status: "unreachable" });
  }

  if (rejected) {
    return NextResponse.json({ status: "rejected" });
  }
  return NextResponse.json({ status: "ringing" });
}
