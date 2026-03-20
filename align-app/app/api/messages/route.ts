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
  prismaUserRowExists,
  prismaGetMessagesBetween,
  prismaAddMessage,
  prismaUpdateLastActive,
  prismaGetMatchIdBetween,
  prismaHasBlockBetween,
  prismaMarkConversationAsRead,
} from "@/lib/repo-prisma";

import { canSendMessage, PAYWALL_MESSAGE } from "@/lib/monetization";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

function resolveUserId(request: NextRequest): string | null {
  const h = request.headers.get("x-user-id")?.trim();
  if (h) return h;
  return getAuthenticatedUserId(request);
}

export async function GET(request: NextRequest) {
  const userId = resolveUserId(request);
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
      const meOk = me != null || (await prismaUserRowExists(userId));
      const otherOk = other != null || (await prismaUserRowExists(withId));
      if (!meOk || !otherOk) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const blocked = await prismaHasBlockBetween(userId, withId);
      if (blocked) {
        return NextResponse.json(
          { messages: [], areFriends: false, matchId: null, currentUserId: userId },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
        );
      }
      await prismaUpdateLastActive(userId);
      await prismaMarkConversationAsRead(userId, withId);
      const list = await prismaGetMessagesBetween(userId, withId);
      const messages = list.map((m) => {
        const rawStatus = (m as { status?: string }).status;
        return {
          id: m.id,
          fromId: m.fromId,
          toId: m.toId,
          text: m.text,
          at: m.at,
          status: rawStatus != null && rawStatus !== "" ? rawStatus : "SENT",
          seenAt: (m as { seenAt?: string }).seenAt ?? null,
          attachmentUrl: m.attachmentContentType === "application/pdf" && m.attachmentUrl
            ? `/api/chat/attachment?messageId=${m.id}`
            : m.attachmentUrl ?? null,
          attachmentContentType: m.attachmentContentType ?? null,
        };
      });
      const matchId = await prismaGetMatchIdBetween(userId, withId);
      return NextResponse.json(
        { messages, areFriends: !!matchId, matchId, currentUserId: userId },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    } catch (err) {
      console.error("[api/messages GET]", err);
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message).split("\n")[0]?.trim() : "";
      const errText = process.env.NODE_ENV === "development" && msg ? msg : "Eroare server. Încearcă din nou.";
      return NextResponse.json({ error: errText }, { status: 500 });
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
    const base = { ...m } as Record<string, unknown>;
    base.status = "SENT";
    if (m.fromId === userId && m.toId === withId && showReadReceipts) {
      const readAt = getMessageReadAt(m.id, withId);
      if (readAt) {
        base.readAt = readAt;
        base.status = "SEEN";
      }
    }
    if (base.attachmentContentType === "application/pdf" && base.attachmentUrl) {
      base.attachmentUrl = `/api/chat/attachment?messageId=${m.id}`;
    }
    if (base.status === "SEEN") base.seenAt = (base.readAt as string) ?? new Date().toISOString();
    return base;
  });
  return NextResponse.json(
    { messages, areFriends, currentUserId: userId },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export async function POST(request: NextRequest) {
  const userId = resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  setUserActive(userId);
  let canSend = true;
  try {
    canSend = await canSendMessage(userId);
  } catch (err) {
    console.error("[api/messages] paywall check failed", err);
  }
  if (!canSend) {
    return NextResponse.json({ error: PAYWALL_MESSAGE }, { status: 402 });
  }
  if (isPrismaAvailable()) {
    let body: { toId?: string; text?: string; attachmentUrl?: string; attachmentContentType?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corp invalid (JSON)." }, { status: 400 });
    }
    try {
      const me = await findUserOrPrisma(userId);
      const meOk = me != null || (await prismaUserRowExists(userId));
      if (!meOk) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const { toId, text, attachmentUrl, attachmentContentType } = body;
      const textStr = typeof text === "string" ? text : "";
      const hasAttachment = attachmentUrl && attachmentContentType;
      if (!toId) {
        return NextResponse.json(
          { error: "Lipsește toId." },
          { status: 400 }
        );
      }
      if (!textStr.trim() && !hasAttachment) {
        return NextResponse.json(
          { error: "Adaugă text sau un atașament (poză/PDF)." },
          { status: 400 }
        );
      }
      const toUser = await findUserOrPrisma(toId);
      const toOk = toUser != null || (await prismaUserRowExists(toId));
      if (!toOk) {
        return NextResponse.json({ error: "Destinatar negăsit." }, { status: 404 });
      }
      const blocked = await prismaHasBlockBetween(userId, toId);
      if (blocked) {
        return NextResponse.json({ error: "Nu poți trimite mesaje acestui utilizator." }, { status: 403 });
      }
      await prismaUpdateLastActive(userId);
      const msg = await prismaAddMessage(
        userId,
        toId,
        textStr,
        hasAttachment ? String(attachmentUrl) : undefined,
        hasAttachment ? String(attachmentContentType) : undefined
      );
      return NextResponse.json({ message: msg });
    } catch (err) {
      console.error("[api/messages POST]", err);
      const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message).split("\n")[0]?.trim() : "";
      if (code === "P2003") {
        return NextResponse.json(
          { error: "Utilizatorul sau destinatarul nu există în baza de date. Reîncearcă după reconectare." },
          { status: 400 }
        );
      }
      if (code === "P2025") {
        return NextResponse.json(
          { error: "Înregistrarea nu a fost găsită. Reîncearcă." },
          { status: 404 }
        );
      }
      const errText = process.env.NODE_ENV === "development" && message ? message : "Eroare server la trimitere. Verifică conexiunea la baza de date sau încearcă din nou.";
      return NextResponse.json({ error: errText }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const body = await request.json();
  const { toId, text, attachmentUrl, attachmentContentType } = body;
  const textStr = typeof text === "string" ? text : "";
  const hasAttachment = attachmentUrl && attachmentContentType;
  if (!toId) {
    return NextResponse.json(
      { error: "Lipsește toId." },
      { status: 400 }
    );
  }
  if (!textStr.trim() && !hasAttachment) {
    return NextResponse.json(
      { error: "Adaugă text sau un atașament (poză/PDF)." },
      { status: 400 }
    );
  }
  if (!findUserById(toId)) {
    return NextResponse.json({ error: "Destinatar negăsit." }, { status: 404 });
  }
  const msg = addMessage(
    userId,
    toId,
    textStr,
    hasAttachment ? String(attachmentUrl) : undefined,
    hasAttachment ? String(attachmentContentType) : undefined
  );
  return NextResponse.json({ message: msg });
}
