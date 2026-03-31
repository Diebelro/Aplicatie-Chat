import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserMapVisibility } from "@/lib/store";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaSetLocationMapVisibility,
  prismaGetMyMapLocation,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { clampMapDurationMinutes } from "@/lib/mapVisibilityConstants";

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const loc = await prismaGetMyMapLocation(userId);
      const now = Date.now();
      const untilActive =
        loc?.mapVisibleUntil && new Date(loc.mapVisibleUntil).getTime() > now
          ? loc.mapVisibleUntil
          : null;
      return NextResponse.json({
        hasLocation: !!loc,
        mapVisibleUntil: untilActive,
      });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  const u = findUserById(userId);
  const has = u?.location_enabled && u.latitude != null && u.longitude != null;
  const until = u?.map_visible_until
    ? new Date(u.map_visible_until).toISOString()
    : null;
  return NextResponse.json({
    hasLocation: !!has,
    mapVisibleUntil: until && (u?.map_visible_until ?? 0) > Date.now() ? until : null,
  });
}

export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  let body: { off?: boolean; durationMinutes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corp invalid." }, { status: 400 });
  }

  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      if (body.off === true) {
        await prismaSetLocationMapVisibility(userId, null);
        setUserMapVisibility(userId, null);
        return NextResponse.json({ ok: true, mapVisibleUntil: null });
      }
      const mins = clampMapDurationMinutes(body.durationMinutes);
      if (mins == null) {
        return NextResponse.json(
          { error: `Alege durata între 15 și 180 minute.` },
          { status: 400 }
        );
      }
      const loc = await prismaGetMyMapLocation(userId);
      if (!loc) {
        return NextResponse.json(
          { error: "Salvează mai întâi locația (ex. din Toate profilurile), apoi activează vizibilitatea pe hartă." },
          { status: 400 }
        );
      }
      const until = new Date(Date.now() + mins * 60_000);
      const { updated } = await prismaSetLocationMapVisibility(userId, until);
      if (!updated) {
        return NextResponse.json({ error: "Nu există locație salvată." }, { status: 400 });
      }
      setUserMapVisibility(userId, until.getTime());
      return NextResponse.json({ ok: true, mapVisibleUntil: until.toISOString() });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }

  const u = findUserById(userId);
  if (!u) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  if (body.off === true) {
    setUserMapVisibility(userId, null);
    return NextResponse.json({ ok: true, mapVisibleUntil: null });
  }
  const mins = clampMapDurationMinutes(body.durationMinutes);
  if (mins == null) {
    return NextResponse.json({ error: `Alege durata între 15 și 180 minute.` }, { status: 400 });
  }
  if (!u.location_enabled || u.latitude == null || u.longitude == null) {
    return NextResponse.json(
      { error: "Salvează mai întâi locația, apoi activează vizibilitatea pe hartă." },
      { status: 400 }
    );
  }
  const until = Date.now() + mins * 60_000;
  setUserMapVisibility(userId, until);
  return NextResponse.json({ ok: true, mapVisibleUntil: new Date(until).toISOString() });
}
