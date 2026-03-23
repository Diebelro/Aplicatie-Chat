import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getMessagesBetween,
  addMessage,
  setUserActive,
  getMessageReadAt,
  getFriendStatus,
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
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { toClientMessageAttachmentFields } from "@/lib/chatAttachmentProxy";

export async function GET(request: NextRequest) {
  const userId = resolveRequestUserId(request);
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
  /** markRead=0: doar sincronizare mesaje (poll), fără updateMany „citit” — altfel DB/rețea se înghesuie la fiecare sute de ms. */
  const markReadParam = request.nextUrl.searchParams.get("markRead");
  const shouldMarkConversationRead = markReadParam !== "0" && markReadParam !== "false";
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
      if (shouldMarkConversationRead) {
        await prismaMarkConversationAsRead(userId, withId);
      }
      const list = await prismaGetMessagesBetween(userId, withId);
      const messages = list.map((m) => {
        const rawStatus = (m as { status?: string }).status;
        const att = toClientMessageAttachmentFields({
          id: m.id,
          attachmentUrl: m.attachmentUrl,
          attachmentContentType: m.attachmentContentType,
        });
        return {
          id: m.id,
          fromId: m.fromId,
          toId: m.toId,
          text: m.text,
          at: m.at,
          status: rawStatus != null && rawStatus !== "" ? rawStatus : "SENT",
          seenAt: (m as { seenAt?: string }).seenAt ?? null,
          attachmentUrl: att.attachmentUrl,
          attachmentContentType: att.attachmentContentType,
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
  /** Bifă „citit” pentru mesajele mele: nu depinde de prietenie (doar modul in-memory; Prisma returnează seenAt din DB). */
  const messages = list.map((m) => {
    const base = { ...m } as Record<string, unknown>;
    base.status = "SENT";
    if (m.fromId === userId && m.toId === withId) {
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
  const userId = resolveRequestUserId(request);
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
      const [me, toUser] = await Promise.all([
        findUserOrPrisma(userId),
        findUserOrPrisma(toId),
      ]);
      const [meOk, toOk] = await Promise.all([
        me != null ? Promise.resolve(true) : prismaUserRowExists(userId),
        toUser != null ? Promise.resolve(true) : prismaUserRowExists(toId),
      ]);
      if (!meOk) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
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
      const att = toClientMessageAttachmentFields({
        id: msg.id,
        attachmentUrl: msg.attachmentUrl,
        attachmentContentType: msg.attachmentContentType,
      });
      return NextResponse.json({
        message: { ...msg, attachmentUrl: att.attachmentUrl, attachmentContentType: att.attachmentContentType },
      });
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
