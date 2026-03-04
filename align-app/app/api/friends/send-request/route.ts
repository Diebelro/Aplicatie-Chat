import { NextRequest, NextResponse } from "next/server";
import { findUserById, addFriendRequest, getUserPrivacySettings } from "@/lib/store";

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const friendId = body?.friend_id ?? body?.friendId;
  if (!friendId || typeof friendId !== "string") {
    return NextResponse.json({ error: "Lipsește friend_id." }, { status: 400 });
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
