import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getConversations,
  getMessagesBetween,
  getUnreadFrom,
  getTotalUnread,
  setUserActive,
  isUserOnline,
  getDistanceKm,
  getFriendStatus,
  getLastActivityAt,
} from "@/lib/store";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaGetConversations,
  prismaGetUnreadFrom,
  prismaUpdateLastActive,
} from "@/lib/repo-prisma";

const ONLINE_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      await prismaUpdateLastActive(userId);
      const list = await prismaGetConversations(userId);
      let totalUnread = 0;
      const conversations = await Promise.all(
        list.map(async (c) => {
          const unreadCount = await prismaGetUnreadFrom(userId, c.otherUser.id);
          totalUnread += unreadCount;
          const lastActive = c.otherUser.last_active ?? null;
          const online = lastActive != null && Date.now() - lastActive < ONLINE_MS;
          return {
            otherUser: {
              ...c.otherUser,
              distanceKm: undefined,
              online,
              lastActivityAt: lastActive ?? undefined,
            },
            lastMessage: c.lastMessage,
            receivedCount: 0,
            unreadCount,
          };
        })
      );
      return NextResponse.json({ conversations, totalUnread });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  setUserActive(userId);
  const list = getConversations(userId);
  const conversations = list.map((c) => {
    const between = getMessagesBetween(userId, c.otherUser.id);
    const receivedCount = between.filter((m) => m.fromId === c.otherUser.id).length;
    const unreadCount = getUnreadFrom(userId, c.otherUser.id);
    const areFriends = getFriendStatus(userId, c.otherUser.id) === "accepted";
    return {
      otherUser: {
        ...c.otherUser,
        distanceKm: getDistanceKm(userId, c.otherUser.id) ?? undefined,
        online: areFriends ? isUserOnline(c.otherUser.id) : undefined,
        lastActivityAt: areFriends ? getLastActivityAt(c.otherUser.id) : undefined,
      },
      lastMessage: c.lastMessage,
      receivedCount,
      unreadCount,
    };
  });
  const totalUnread = getTotalUnread(userId);
  return NextResponse.json({ conversations, totalUnread });
}
