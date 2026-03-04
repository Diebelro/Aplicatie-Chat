import { NextRequest, NextResponse } from "next/server";
import { rejectFriendRequest } from "@/lib/store";

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
  const ok = rejectFriendRequest(userId, friendId);
  if (!ok) {
    return NextResponse.json(
      { error: "Cerere negăsită sau deja răspunsoare." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
