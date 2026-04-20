import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

/** Exportul poate fi greu (multe tabele); pe Vercel evităm timeout prematur. */
export const maxDuration = 60;
import { isPrismaAvailable } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";
import { findUserById } from "@/lib/store";

const EXPORT_COOLDOWN_MS = 120_000;
const GLOBAL_KEY = "__alignGdprExportCooldown";

const MESSAGES_CAP = 15_000;
const SWIPES_CAP = 8_000;
const VISITS_CAP = 3_000;

function getCooldownMap(): Map<string, number> {
  const g = globalThis as unknown as { [GLOBAL_KEY]?: Map<string, number> };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY]!;
}

function assertExportCooldown(userId: string): NextResponse | null {
  const now = Date.now();
  const last = getCooldownMap().get(userId) ?? 0;
  if (now - last < EXPORT_COOLDOWN_MS) {
    return NextResponse.json({ error: "Prea multe cereri. Încearcă mai târziu." }, { status: 429 });
  }
  return null;
}

function markExportDone(userId: string): void {
  getCooldownMap().set(userId, Date.now());
}

function attachmentFilename(userId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `align-date-personale-${userId.slice(0, 8)}-${day}.json`;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const cooldown = assertExportCooldown(userId);
  if (cooldown) return cooldown;

  if (!isPrismaAvailable()) {
    const u = findUserById(userId);
    if (!u) {
      return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
    }
    const { photos, ...rest } = u;
    const payload = {
      exportVersion: 1,
      generatedAt: new Date().toISOString(),
      source: "memory_store",
      limits: { note: "În producție, exportul complet folosește baza de date." },
      user: rest,
      photos: photos ?? [],
    };
    const body = JSON.stringify(payload, null, 2);
    markExportDone(userId);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${attachmentFilename(userId)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
        isBanned: true,
        banUntil: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            name: true,
            username: true,
            realName: true,
            bio: true,
            birthDate: true,
            gender: true,
            country: true,
            city: true,
            postalCode: true,
            educationLevel: true,
            occupation: true,
            maritalStatus: true,
            wantsChildren: true,
            height: true,
            weight: true,
            eyeColor: true,
            hairColor: true,
            bodyType: true,
            clothingStyle: true,
            distinctiveFeatures: true,
            physicalAsset: true,
            physicalAssetDetail: true,
            partnerPhysicalPreferences: true,
            partnerLifestyle: true,
            partnerDealBreakers: true,
            showDistance: true,
            showOnline: true,
            showProfileVisits: true,
            showReadReceipts: true,
            allowFriendRequests: true,
            completedAt: true,
            lastActiveAt: true,
            createdAt: true,
            updatedAt: true,
            photos: { orderBy: { order: "asc" }, select: { id: true, order: true, url: true, createdAt: true } },
          },
        },
        locations: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            mapVisibleUntil: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
    }

    const [
      messages,
      matches,
      swipes,
      blocksInitiated,
      blocksReceived,
      reportsMade,
      reportsReceived,
      deviceFingerprints,
      webPushSubscriptions,
      userPushDevices,
      missedCalls,
      visitsAsViewer,
      visitsAsProfile,
      appFeedback,
      banAppeals,
      premiumSubscriptions,
      boosts,
    ] = await Promise.all([
      prisma.message.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        orderBy: { createdAt: "asc" },
        take: MESSAGES_CAP,
        select: {
          id: true,
          fromUserId: true,
          toUserId: true,
          text: true,
          attachmentUrl: true,
          attachmentContentType: true,
          status: true,
          createdAt: true,
          deliveredAt: true,
          seenAt: true,
          isPlatformNotice: true,
          platformNoticeExpiresAt: true,
        },
      }),
      prisma.match.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { id: true, userAId: true, userBId: true, createdAt: true },
      }),
      prisma.swipe.findMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
        orderBy: { createdAt: "desc" },
        take: SWIPES_CAP,
        select: { id: true, fromUserId: true, toUserId: true, liked: true, createdAt: true, updatedAt: true },
      }),
      prisma.block.findMany({
        where: { blockerId: userId },
        select: { id: true, blockedId: true, createdAt: true },
      }),
      prisma.block.findMany({
        where: { blockedId: userId },
        select: { id: true, blockerId: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { reporterId: userId },
        select: { id: true, reportedId: true, reason: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { reportedId: userId },
        select: { id: true, reporterId: true, reason: true, createdAt: true },
      }),
      prisma.deviceFingerprint.findMany({
        where: { userId },
        select: { id: true, fingerprint: true, userAgent: true, ip: true, trusted: true, createdAt: true, updatedAt: true },
      }),
      prisma.webPushSubscription.findMany({
        where: { userId },
        select: { id: true, endpoint: true, createdAt: true, updatedAt: true },
      }),
      prisma.userPushDevice.findMany({
        where: { userId },
        select: { id: true, platform: true, createdAt: true, updatedAt: true },
      }),
      prisma.missedCall.findMany({
        where: { toUserId: userId },
        select: { id: true, roomId: true, fromId: true, audioOnly: true, ringAt: true },
      }),
      prisma.visit.findMany({
        where: { viewerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: VISITS_CAP,
        select: { id: true, profileUserId: true, createdAt: true },
      }),
      prisma.visit.findMany({
        where: { profileUserId: userId },
        orderBy: { createdAt: "desc" },
        take: VISITS_CAP,
        select: { id: true, viewerUserId: true, createdAt: true },
      }),
      prisma.appFeedback.findMany({
        where: { userId },
        select: { id: true, message: true, pageUrl: true, createdAt: true },
      }),
      prisma.banAppeal.findMany({
        where: { userId },
        select: { id: true, message: true, status: true, createdAt: true, resolvedAt: true },
      }),
      prisma.premiumSubscription.findMany({
        where: { userId },
        select: { id: true, planId: true, status: true, currentPeriodEnd: true, createdAt: true, updatedAt: true },
      }),
      prisma.boost.findMany({
        where: { userId },
        select: { id: true, expiresAt: true, createdAt: true },
      }),
    ]);

    const { ...account } = row;

    const payload = {
      exportVersion: 1,
      generatedAt: new Date().toISOString(),
      source: "prisma",
      limits: {
        messagesMax: MESSAGES_CAP,
        swipesMax: SWIPES_CAP,
        visitsMaxEachDirection: VISITS_CAP,
        note:
          messages.length >= MESSAGES_CAP
            ? "Lista de mesaje poate fi trunchiată; s-au inclus primele în ordine cronologică, până la limita indicată."
            : undefined,
      },
      account,
      messages,
      matches,
      swipes,
      blocksInitiated,
      blocksReceived,
      reportsMade,
      reportsReceived,
      deviceFingerprints,
      webPushSubscriptions,
      userPushDevices,
      missedCalls,
      visitsAsViewer,
      visitsAsProfile,
      appFeedback,
      banAppeals,
      premiumSubscriptions,
      boosts,
    };

    const body = JSON.stringify(payload, null, 2);
    markExportDone(userId);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${attachmentFilename(userId)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/me/export]", err);
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
