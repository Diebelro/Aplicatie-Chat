import { NextRequest, NextResponse } from "next/server";
import {
  addMatch,
  canPerformLike,
  findUserById,
  setUserActive,
  isMutualMatch,
  upsertUserSwipe,
  removeMutualMatchPair,
  getSwipeFromTo,
  mutualMatchPairExists,
} from "@/lib/store";
import { adjustIntervalsAfterLike } from "@/lib/feedBuilder";
import { isDeviceBlocked, recordSuspiciousBehavior, logSuspiciousEvent } from "@/lib/deviceBlock";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaAddSwipe,
  prismaIsMutualMatch,
  prismaAddMatch,
  prismaLogRateLimit,
  prismaGetSwipeLiked,
  prismaDeleteMatchBetween,
  prismaMatchRowExistsBetween,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  const deviceId = request.headers.get("x-device-id")?.trim();
  const fingerprint = request.headers.get("x-device-fingerprint")?.trim() ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const ip = getClientIp(request);
  if (isDeviceBlocked(fingerprint ?? null, deviceId ?? null)) {
    logSuspiciousEvent({
      reason: "blocked_device_access",
      userId,
      deviceId: deviceId ?? undefined,
      fingerprint: fingerprint ?? undefined,
      ip,
    });
    return NextResponse.json(
      { error: "Dispozitivul este blocat din cauza unui comportament suspect." },
      { status: 403 }
    );
  }
  const pathname = "/api/swipe";
  if (!checkRateLimit(ip, userId, pathname)) {
    if (isPrismaAvailable()) {
      try {
        await prismaLogRateLimit({
          identifier: userId || ip,
          endpoint: pathname,
          count: 1,
          windowStart: new Date(Date.now() - 60 * 1000),
        });
      } catch {}
    }
    return NextResponse.json(
      { error: "Prea multe cereri. Încearcă mai târziu." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  setUserActive(userId);
  const user = await findUserOrPrisma(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const body = await request.json();
  const { toId, liked, internalInterval, externalInterval } = body;
  if (!toId || typeof liked !== "boolean") {
    return NextResponse.json(
      { error: "Lipsesc toId sau liked." },
      { status: 400 }
    );
  }

  if (isPrismaAvailable()) {
    try {
      const prev = await prismaGetSwipeLiked(userId, toId);
      if (prev !== null && prev === liked) {
        return NextResponse.json({ ok: true, unchanged: true, status: "UNCHANGED" });
      }

      const hadMatchRow = await prismaMatchRowExistsBetween(userId, toId);
      await prismaAddSwipe(userId, toId, liked);

      if (!liked) {
        await prismaDeleteMatchBetween(userId, toId);
        return NextResponse.json({ ok: true, fastSwipe: false, status: "NO_MATCH" });
      }

      const mutual = await prismaIsMutualMatch(userId, toId);
      let matchCreated = false;
      if (mutual) {
        await prismaAddMatch(userId, toId);
        matchCreated = !hadMatchRow;
      }
      const updated = adjustIntervalsAfterLike(
        typeof internalInterval === "number" ? internalInterval : 12,
        typeof externalInterval === "number" ? externalInterval : 22
      );
      if (matchCreated) {
        return NextResponse.json({
          ok: true,
          matchCreated: true,
          status: "MATCH_CREATED",
          internalInterval: updated.internalInterval,
          externalInterval: updated.externalInterval,
        });
      }
      return NextResponse.json({
        ok: true,
        matchCreated: false,
        status: "NO_MATCH",
        internalInterval: updated.internalInterval,
        externalInterval: updated.externalInterval,
      });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }

  const existingSwipe = getSwipeFromTo(userId, toId);
  if (existingSwipe && existingSwipe.liked === liked) {
    return NextResponse.json({ ok: true, unchanged: true, status: "UNCHANGED" });
  }

  const hadMatchPair = mutualMatchPairExists(userId, toId);

  if (existingSwipe?.liked === true && liked === false) {
    removeMutualMatchPair(userId, toId);
  }

  upsertUserSwipe(userId, toId, liked);

  if (!liked) {
    return NextResponse.json({ ok: true, fastSwipe: false, status: "NO_MATCH" });
  }

  if (!canPerformLike(userId)) {
    recordSuspiciousBehavior(fingerprint ?? null, deviceId ?? null, {
      reason: "fast_swipe",
      userId,
      ip,
      toId: toId as string,
    });
    return NextResponse.json(
      { error: "Prea multe acțiuni rapid. Încearcă în câteva secunde." },
      { status: 429 }
    );
  }

  const updated = adjustIntervalsAfterLike(
    typeof internalInterval === "number" ? internalInterval : 12,
    typeof externalInterval === "number" ? externalInterval : 22
  );
  let matchCreated = false;
  if (isMutualMatch(userId, toId)) {
    addMatch(userId, toId);
    matchCreated = !hadMatchPair;
  }
  return NextResponse.json({
    matchCreated,
    internalInterval: updated.internalInterval,
    externalInterval: updated.externalInterval,
  });
}
