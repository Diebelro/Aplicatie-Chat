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
  prismaGetConversationsWithMatches,
  prismaGetUnreadFrom,
  prismaUpdateLastActive,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

const ONLINE_MS = 60 * 1000; // sub 1 min = instant ca WhatsApp

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
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
      const list = await prismaGetConversationsWithMatches(userId);
      let totalUnread = 0;
      const conversations = await Promise.all(
        list.map(async (c) => {
          const unreadCount = c.noMessagesYet ? 0 : await prismaGetUnreadFrom(userId, c.otherUser.id);
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
            noMessagesYet: c.noMessagesYet ?? false,
          };
        })
      );
      conversations.sort((a, b) => {
        const unreadDiff = (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0);
        if (unreadDiff !== 0) return unreadDiff;
        return new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime();
      });
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
  conversations.sort((a, b) => {
    const unreadDiff = (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0);
    if (unreadDiff !== 0) return unreadDiff;
    return new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime();
  });
  const totalUnread = getTotalUnread(userId);
  return NextResponse.json({ conversations, totalUnread });
}
