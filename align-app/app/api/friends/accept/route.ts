import { NextRequest, NextResponse } from "next/server";
import { acceptFriendRequest } from "@/lib/store";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaAcceptFriendRequest } from "@/lib/repo-prisma";

export async function POST(request: NextRequest) {
  const userId = (await resolveRequestUserId(request)) ?? request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const friendId = body?.friend_id ?? body?.friendId;
  if (!friendId || typeof friendId !== "string") {
    return NextResponse.json({ error: "Lipsește friend_id." }, { status: 400 });
  }

  if (isPrismaAvailable()) {
    try {
      const ok = await prismaAcceptFriendRequest(userId, friendId);
      if (!ok) {
        return NextResponse.json({ error: "Cerere negăsită sau deja răspunsoare." }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[api/friends/accept] prisma", e);
    }
  }

  const ok = acceptFriendRequest(userId, friendId);
  if (!ok) {
    return NextResponse.json({ error: "Cerere negăsită sau deja răspunsoare." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
