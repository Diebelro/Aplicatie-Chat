import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/store";
import { findUserOrPrisma, prismaUserRowExists, isPrismaAvailable } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { getPendingIncomingForCallee, clearPendingIncomingForCallee } from "@/lib/callPending";

/** Accept the call (callee). Same as /api/call/answer. Returns roomId and audioOnly for redirect. */
export async function POST(request: NextRequest) {
  const userId = resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const okUser =
    (await findUserOrPrisma(userId)) != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!okUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const pending = await getPendingIncomingForCallee(userId);
  if (!pending) {
    return NextResponse.json({ error: "No incoming call." }, { status: 404 });
  }
  await clearPendingIncomingForCallee(userId);
  return NextResponse.json({
    roomId: pending.roomId,
    audioOnly: pending.audioOnly,
  });
}
