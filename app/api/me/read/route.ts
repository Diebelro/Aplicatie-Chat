import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getMessagesBetween,
  setConversationRead,
  markConversationMessagesAsRead,
} from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaMarkConversationAsRead } from "@/lib/repo-prisma";

/** Mark conversation with otherId as read (when opening chat). Also records message_reads for read receipts. */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const otherId = body.otherId;
  if (!otherId || typeof otherId !== "string") {
    return NextResponse.json(
      { error: "Lipsește otherId." },
      { status: 400 }
    );
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      await prismaMarkConversationAsRead(userId, otherId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const between = getMessagesBetween(userId, otherId);
  const lastAt =
    between.length > 0
      ? between[between.length - 1].at
      : new Date().toISOString();
  setConversationRead(userId, otherId, lastAt);
  markConversationMessagesAsRead(userId, otherId);
  return NextResponse.json({ ok: true });
}
