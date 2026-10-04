import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  findUserOrPrisma,
  isPrismaAvailable,
  prismaGetUserRole,
  prismaCreateAdminLog,
  prismaInsertPlatformNoticeInThread,
} from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";
import { parseBanReasonFromBody, photoRemovedNoticeRo } from "@/lib/banReasons";

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

/** Listează pozele de profil ale userului. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: targetId } = await params;
  const profile = await prisma.profile.findUnique({
    where: { userId: targetId },
    include: { photos: { orderBy: { order: "asc" } } },
  });
  if (!profile) return NextResponse.json({ photos: [] });
  return NextResponse.json({
    photos: profile.photos.map((ph) => ({
      id: ph.id,
      url: ph.url,
      order: ph.order,
      createdAt: ph.createdAt.toISOString(),
    })),
  });
}

/**
 * Șterge o poză (photoId) sau toate (all=1).
 * Body: { photoId?: string, all?: boolean }
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: targetId } = await params;
  const target = await findUserOrPrisma(targetId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const photoId = typeof body?.photoId === "string" ? body.photoId.trim() : "";
  const all = body?.all === true;
  const parsed = parseBanReasonFromBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: targetId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profil negăsit." }, { status: 404 });

  try {
    if (all) {
      const { count } = await prisma.profilePhoto.deleteMany({ where: { profileId: profile.id } });
      await prismaCreateAdminLog(
        auth.userId,
        "DELETE_PROFILE_PHOTOS",
        targetId,
        `Șterse toate pozele (${count}) — ${parsed.stored}`
      );
      if (count > 0 && targetId !== auth.userId) {
        await prismaInsertPlatformNoticeInThread(
          auth.userId,
          targetId,
          photoRemovedNoticeRo(parsed.stored, true)
        );
      }
      return NextResponse.json({ ok: true, deleted: count });
    }

    if (!photoId) {
      return NextResponse.json({ error: "Lipsește photoId sau all:true." }, { status: 400 });
    }

    const photo = await prisma.profilePhoto.findFirst({
      where: { id: photoId, profileId: profile.id },
    });
    if (!photo) return NextResponse.json({ error: "Poză negăsită." }, { status: 404 });

    await prisma.profilePhoto.delete({ where: { id: photoId } });
    await prismaCreateAdminLog(auth.userId, "DELETE_PROFILE_PHOTO", targetId, `${photoId} — ${parsed.stored}`);
    if (targetId !== auth.userId) {
      await prismaInsertPlatformNoticeInThread(
        auth.userId,
        targetId,
        photoRemovedNoticeRo(parsed.stored, false)
      );
    }
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (e) {
    console.error("[admin photos DELETE]", e);
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
