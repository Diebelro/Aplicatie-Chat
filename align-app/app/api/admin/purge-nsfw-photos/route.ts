import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaCreateAdminLog } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";
import { moderateImageUrl } from "@/lib/imageNsfwModeration";

/**
 * Admin: scanează poze profil recente și șterge cele NSFW.
 * POST { limit?: number, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(80, Math.max(1, Number(body?.limit) || 40));
  const dryRun = body?.dryRun === true;

  const photos = await prisma.profilePhoto.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      profile: { select: { userId: true, username: true, name: true } },
    },
  });

  const removed: Array<{ photoId: string; userId: string; username: string | null }> = [];
  let scanned = 0;
  const errors: string[] = [];

  for (const photo of photos) {
    scanned += 1;
    const url = String(photo.url || "").trim();
    if (!url || url.startsWith("/avatars/")) continue;
    try {
      const mod = await moderateImageUrl(url);
      if (!mod.ok && mod.reason === "nsfw") {
        if (!dryRun) {
          await prisma.profilePhoto.delete({ where: { id: photo.id } });
        }
        removed.push({
          photoId: photo.id,
          userId: photo.profile.userId,
          username: photo.profile.username ?? photo.profile.name,
        });
      } else if (!mod.ok && mod.reason === "unavailable") {
        errors.push(`${photo.id}: ${mod.message}`);
      }
    } catch (e) {
      errors.push(`${photo.id}: ${e instanceof Error ? e.message : "err"}`);
    }
  }

  if (!dryRun && removed.length > 0) {
    await prismaCreateAdminLog(
      userId,
      "PURGE_NSFW_PHOTOS",
      null,
      JSON.stringify({ removed: removed.length, scanned, dryRun })
    ).catch(() => null);
  }

  return NextResponse.json({
    dryRun,
    scanned,
    removedCount: removed.length,
    removed,
    keptHint: scanned - removed.length,
    errors: errors.slice(0, 20),
  });
}
