import { NextRequest } from "next/server";
import { findUserOrPrisma, prismaUserRowExists, isPrismaAvailable } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { getPendingIncomingForCallee } from "@/lib/callPending";
import { findUserById } from "@/lib/store";
import { rateLimitAllow } from "@/lib/callRateLimit";
import { callPollErrorResponse, callPollJsonResponse } from "@/lib/callPollHttp";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
/** Poll vizibil ~800ms + tab-uri multiple — marjă peste trafic legitim. */
const RATE_MAX_PER_USER = 300;

/** Poll: apel în așteptare pentru utilizatorul curent (callee). */
export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return callPollErrorResponse("SIGNALING_TOKEN_INVALID", "Neautorizat.", 401);
  }
  if (!rateLimitAllow(`call-incoming:${userId}`, RATE_MAX_PER_USER, RATE_WINDOW_MS)) {
    return callPollErrorResponse("SIGNALING_SERVICE_UNAVAILABLE", "Prea multe cereri.", 429);
  }
  const user = await findUserOrPrisma(userId);
  const exists =
    user != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!exists) {
    return callPollErrorResponse("UNKNOWN", "Utilizator negăsit.", 404);
  }
  const pending = await getPendingIncomingForCallee(userId);
  if (!pending) {
    return callPollJsonResponse({ incoming: null });
  }
  const fromUser = await findUserOrPrisma(pending.fromId);
  return callPollJsonResponse({
    incoming: {
      fromId: pending.fromId,
      fromName: fromUser?.name ?? fromUser?.username ?? "",
      roomId: pending.roomId,
      audioOnly: pending.audioOnly,
      pendingSince: pending.pendingSince,
    },
  });
}
