import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getMessagesBetween,
  addMessage,
  setUserActive,
  getMessageReadAt,
  getFriendStatus,
  getUserPrivacySettings,
} from "@/lib/store";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaGetMessagesBetween,
  prismaAddMessage,
  prismaUpdateLastActive,
  prismaGetMatchIdBetween,
  prismaHasBlockBetween,
} from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  setUserActive(userId);
  const withId = request.nextUrl.searchParams.get("with");
  if (!withId) {
    return NextResponse.json(
      { error: "Lipsește parametrul with." },
      { status: 400 }
    );
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      const other = await findUserOrPrisma(withId);
      if (!me || !other) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const blocked = await prismaHasBlockBetween(userId, withId);
      if (blocked) {
        return NextResponse.json({ messages: [], areFriends: false, matchId: null });
      }
      await prismaUpdateLastActive(userId);
      const list = await prismaGetMessagesBetween(userId, withId);
      const matchId = await prismaGetMatchIdBetween(userId, withId);
      return NextResponse.json({ messages: list, areFriends: !!matchId, matchId });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId) || !findUserById(withId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const list = getMessagesBetween(userId, withId);
  const areFriends = getFriendStatus(userId, withId) === "accepted";
  const readerPrivacy = getUserPrivacySettings(withId);
  const showReadReceipts = areFriends && readerPrivacy.allowReadReceipts;
  const messages = list.map((m) => {
    const base = { ...m };
    if (m.fromId === userId && m.toId === withId && showReadReceipts) {
      const readAt = getMessageReadAt(m.id, withId);
      if (readAt) (base as Record<string, unknown>).readAt = readAt;
    }
    return base;
  });
  return NextResponse.json({ messages, areFriends });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  setUserActive(userId);
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const body = await request.json();
      const { toId, text } = body;
      if (!toId || !text || typeof text !== "string") {
        return NextResponse.json(
          { error: "Lipsesc toId sau text." },
          { status: 400 }
        );
      }
      const toUser = await findUserOrPrisma(toId);
      if (!toUser) {
        return NextResponse.json({ error: "Destinatar negăsit." }, { status: 404 });
      }
      const blocked = await prismaHasBlockBetween(userId, toId);
      if (blocked) {
        return NextResponse.json({ error: "Nu poți trimite mesaje acestui utilizator." }, { status: 403 });
      }
      await prismaUpdateLastActive(userId);
      const msg = await prismaAddMessage(userId, toId, text);
      return NextResponse.json({ message: msg });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const body = await request.json();
  const { toId, text } = body;
  if (!toId || !text || typeof text !== "string") {
    return NextResponse.json(
      { error: "Lipsesc toId sau text." },
      { status: 400 }
    );
  }
  if (!findUserById(toId)) {
    return NextResponse.json({ error: "Destinatar negăsit." }, { status: 404 });
  }
  const msg = addMessage(userId, toId, text);
  return NextResponse.json({ message: msg });
}
