import { NextRequest, NextResponse } from "next/server";
import { findUserById, getFriendsList, isUserOnline, getLastActivityAt } from "@/lib/store";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const friendIds = getFriendsList(userId);
  const friends = friendIds
    .map((id) => findUserById(id))
    .filter(Boolean)
    .map((u) => ({
      ...u!,
      online: isUserOnline(u!.id),
      lastActivityAt: getLastActivityAt(u!.id),
    }));
  return NextResponse.json({ friends });
}
