import { NextRequest, NextResponse } from "next/server";
import { findUserById, addFriendRequest, getUserPrivacySettings } from "@/lib/store";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaFindUserById, prismaAddFriendRequest } from "@/lib/repo-prisma";

export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
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
      const target = await prismaFindUserById(friendId);
      if (!target) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const ok = await prismaAddFriendRequest(userId, friendId);
      if (!ok) {
        return NextResponse.json(
          { error: "Cerere existentă sau relație deja existentă." },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[api/friends/send-request] prisma", e);
    }
  }

  if (!findUserById(friendId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const targetSettings = getUserPrivacySettings(friendId);
  if (!targetSettings.allowFriendRequests) {
    return NextResponse.json(
      { error: "Acest utilizator nu acceptă cereri de prietenie." },
      { status: 403 }
    );
  }
  const row = addFriendRequest(userId, friendId);
  if (!row) {
    return NextResponse.json(
      { error: "Cerere existentă sau relație deja existentă." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, id: row.id });
}
