import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isRoomRejected } from "@/lib/store";
import { isPrismaAvailable, prismaIsCallRejectedRoom } from "@/lib/repo-prisma";
import { callApiCallerUserExists } from "@/lib/callCallerExists";

/** Caller polls this to know if the callee rejected. Returns { status: "ringing" | "rejected" }. */
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
  const rejectedInDb = isPrismaAvailable() && (await prismaIsCallRejectedRoom(roomId));
  const status = rejectedInDb || isRoomRejected(roomId) ? "rejected" : "ringing";
  return NextResponse.json({ status });
}
