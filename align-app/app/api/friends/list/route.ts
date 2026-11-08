import { NextRequest, NextResponse } from "next/server";
import { findUserById, getFriendsList, isUserOnline, getLastActivityAt } from "@/lib/store";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetFriendsList } from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  if (isPrismaAvailable()) {
    try {
      const users = await prismaGetFriendsList(userId);
      const friends = users.map((u) => ({
        ...u,
        online: isUserOnline(u.id),
        lastActivityAt: getLastActivityAt(u.id),
      }));
      return NextResponse.json({ friends });
    } catch (e) {
      console.error("[api/friends/list] prisma", e);
    }
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
