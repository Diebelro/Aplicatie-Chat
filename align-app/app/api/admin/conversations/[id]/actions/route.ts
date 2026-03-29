import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { prisma } from "@/lib/db";
import {
  findUserOrPrisma,
  isPrismaAvailable,
  prismaGetUserRole,
  prismaCreateAdminLog,
  prismaInsertPlatformNoticeInThread,
  prismaDeleteAllMessagesBetweenUsers,
} from "@/lib/repo-prisma";
import { PLATFORM_MODERATION_NOTICE_RO } from "@/lib/platformModerationNotice";

async function requireAdmin(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }
  return { userId };
}

type ActionKind = "WARN_PLATFORM" | "BAN" | "SUSPEND" | "DELETE_USER" | "DELETE_THREAD";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parts = id.split("_");
  if (parts.length !== 2) {
    return NextResponse.json({ error: "ID invalid (userId1_userId2)." }, { status: 400 });
  }
  const [userAId, userBId] = parts;
  const body = await request.json().catch(() => ({}));
  const action = body?.action as ActionKind | undefined;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!targetUserId || (targetUserId !== userAId && targetUserId !== userBId)) {
    return NextResponse.json({ error: "targetUserId trebuie să fie unul dintre cei doi participanți." }, { status: 400 });
  }
  if (targetUserId === auth.userId) {
    return NextResponse.json({ error: "Nu poți aplica acțiunea asupra propriului cont." }, { status: 400 });
  }
  const peerUserId = targetUserId === userAId ? userBId : userAId;
  const target = await findUserOrPrisma(targetUserId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });

  try {
    if (action === "WARN_PLATFORM") {
      await prismaInsertPlatformNoticeInThread(peerUserId, targetUserId, PLATFORM_MODERATION_NOTICE_RO);
      await prismaCreateAdminLog(auth.userId, "PLATFORM_NOTICE_CHAT", targetUserId, `thread ${id}`);
      return NextResponse.json({ ok: true });
    }
    if (action === "BAN") {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { isBanned: true, banUntil: null },
      });
      await prismaCreateAdminLog(auth.userId, "BAN_USER", targetUserId, `din conversație ${id}`);
      return NextResponse.json({ ok: true });
    }
    if (action === "SUSPEND") {
      const hours = Number(body?.hours);
      if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
        return NextResponse.json({ error: "hours trebuie să fie între 1 și 168." }, { status: 400 });
      }
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: targetUserId },
        data: { isBanned: true, banUntil: until },
      });
      const detail = `${hours}h până la ${until.toISOString()} · conv ${id}`;
      await prismaCreateAdminLog(auth.userId, "SUSPEND_USER", targetUserId, detail.slice(0, 4000));
      return NextResponse.json({ ok: true, banUntil: until.toISOString() });
    }
    if (action === "DELETE_THREAD") {
      const n = await prismaDeleteAllMessagesBetweenUsers(userAId, userBId);
      await prismaCreateAdminLog(auth.userId, "DELETE_CONVERSATION_MESSAGES", id, `${n} mesaje șterse`);
      return NextResponse.json({ ok: true, deletedCount: n });
    }
    if (action === "DELETE_USER") {
      await prisma.user.delete({ where: { id: targetUserId } });
      await prismaCreateAdminLog(auth.userId, "DELETE_USER", targetUserId, `din conversație ${id}`);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acțiune necunoscută." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
