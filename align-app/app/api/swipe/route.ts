import { NextRequest, NextResponse } from "next/server";
import { addLike, addPass, addMatch, canPerformLike, findUserById, hasSwiped, setUserActive, isMutualMatch } from "@/lib/store";
import { adjustIntervalsAfterLike } from "@/lib/feedBuilder";
import { isDeviceBlocked, recordSuspiciousBehavior, logSuspiciousEvent } from "@/lib/deviceBlock";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaHasSwiped,
  prismaAddSwipe,
  prismaIsMutualMatch,
  prismaAddMatch,
  prismaLogRateLimit,
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
  const userId = resolveRequestUserId(request);
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
      const already = await prismaHasSwiped(userId, toId);
      if (already) {
        return NextResponse.json({ ok: true, already: true, status: "ALREADY" });
      }
      await prismaAddSwipe(userId, toId, liked);
      if (!liked) {
        return NextResponse.json({ ok: true, fastSwipe: false, status: "NO_MATCH" });
      }
      const matchCreated = await prismaIsMutualMatch(userId, toId);
      if (matchCreated) {
        await prismaAddMatch(userId, toId);
        const updated = adjustIntervalsAfterLike(
          typeof internalInterval === "number" ? internalInterval : 12,
          typeof externalInterval === "number" ? externalInterval : 22
        );
        return NextResponse.json({
          ok: true,
          matchCreated: true,
          status: "MATCH_CREATED",
          internalInterval: updated.internalInterval,
          externalInterval: updated.externalInterval,
        });
      }
      const updated = adjustIntervalsAfterLike(
        typeof internalInterval === "number" ? internalInterval : 12,
        typeof externalInterval === "number" ? externalInterval : 22
      );
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

  if (hasSwiped(userId, toId)) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (!liked) {
    addPass(userId, toId);
    return NextResponse.json({ ok: true, fastSwipe: false });
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
  addLike(userId, toId);
  const updated = adjustIntervalsAfterLike(
    typeof internalInterval === "number" ? internalInterval : 12,
    typeof externalInterval === "number" ? externalInterval : 22
  );
  let matchCreated = false;
  if (isMutualMatch(userId, toId)) {
    addMatch(userId, toId);
    matchCreated = true;
  }
  return NextResponse.json({
    matchCreated,
    internalInterval: updated.internalInterval,
    externalInterval: updated.externalInterval,
  });
}
