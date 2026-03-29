import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getMessagesBetween,
  setConversationRead,
  markConversationMessagesAsRead,
} from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaMarkConversationAsRead } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

/** Mark conversation with otherId as read (when opening chat). Also records message_reads for read receipts. */
export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
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
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message).split("\n")[0]?.trim() : "";
      const errText = process.env.NODE_ENV === "development" && msg ? msg : "Eroare server.";
      return NextResponse.json({ error: errText }, { status: 500 });
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
