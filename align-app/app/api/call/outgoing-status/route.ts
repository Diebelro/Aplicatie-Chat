import { NextRequest } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isRoomRejected, isRoomCallAnswered } from "@/lib/store";
import {
  isPrismaAvailable,
  prismaGetPendingIncomingRowByRoomId,
  prismaIsCallRejectedRoom,
  prismaIsCallAnsweredRoom,
} from "@/lib/repo-prisma";
import { callApiCallerUserExists } from "@/lib/callCallerExists";
import { getPendingIncomingForCallee } from "@/lib/callPending";
import { parseVideoRoomId } from "@/lib/videoCall";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { callPollJsonResponse } from "@/lib/callPollHttp";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
/** Poll ~109/min + retry 401 + tab-uri multiple — marjă peste trafic legitim. */
const RATE_MAX_PER_USER = 280;

/**
 * Apelantul (caller) întreabă starea apelului 1-la-1:
 * - `ringing` — încă sună sau apelul tocmai a fost acceptat (conectare în curs).
 * - `rejected` — celălalt a apăsat explicit Respinge (sau echivalent API decline/reject).
 * - `unreachable` — nu mai sună și nu e respins explicit (offline, tab închis, apel anulat, expirat etc.).
 *
 * Pentru P2P: după `getPendingIncomingForCallee`, verificăm și rândul după `roomId` în Prisma
 * (aceeași sursă de adevăr ca la `/api/call/ring`) ca să reducem false `unreachable` la re-sunare.
 */
export async function GET(request: NextRequest) {
  let userId = await getAuthenticatedUserId(request);
  if (!userId) {
    userId = request.headers.get("x-user-id")?.trim() || null;
  }
  if (!userId) {
    return callPollJsonResponse({ error: "Neautorizat." }, 401);
  }
  if (!rateLimitAllow(`call-outst:${userId}`, RATE_MAX_PER_USER, RATE_WINDOW_MS)) {
    return callPollJsonResponse({ error: "Prea multe cereri." }, 429);
  }
  if (!(await callApiCallerUserExists(userId))) {
    return callPollJsonResponse({ error: "Utilizator negăsit." }, 404);
  }
  const roomId = request.nextUrl.searchParams.get("roomId");
  if (!roomId) {
    return callPollJsonResponse({ error: "Lipsește roomId." }, 400);
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
      return callPollJsonResponse({ error: "Nu ai acces la acest roomId." }, 403);
    }
    const calleeId = a === userId ? b : a;
    const pending = await getPendingIncomingForCallee(calleeId);
    const stillRinging =
      pending != null && pending.roomId === roomId && pending.fromId === userId;

    if (stillRinging || answered) {
      return callPollJsonResponse({ status: "ringing" });
    }
    if (rejected) {
      return callPollJsonResponse({ status: "rejected" });
    }
    if (isPrismaAvailable()) {
      const row = await prismaGetPendingIncomingRowByRoomId(roomId);
      if (row && row.fromId === userId && row.toUserId === calleeId) {
        return callPollJsonResponse({ status: "ringing" });
      }
    }
    return callPollJsonResponse({ status: "unreachable" });
  }

  if (rejected) {
    return callPollJsonResponse({ status: "rejected" });
  }
  return callPollJsonResponse({ status: "ringing" });
}
