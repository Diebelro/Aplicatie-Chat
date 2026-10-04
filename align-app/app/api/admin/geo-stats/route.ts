import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";
import {
  guessIpMarket,
  ipMarketLabel,
  profileCountryBucket,
  type IpMarketGuess,
} from "@/lib/adminGeoBuckets";

const MAX_DAYS = 90;

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Necesită DATABASE_URL." }, { status: 503 });
  }
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }

  const daysRaw = Number(request.nextUrl.searchParams.get("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.min(MAX_DAYS, Math.max(1, Math.floor(daysRaw))) : 30;
  const since = new Date(Date.now() - days * 86400000);
  const marketFilter = (request.nextUrl.searchParams.get("market") || "").trim().toLowerCase();

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      email: true,
      createdAt: true,
      isBanned: true,
      profile: {
        select: {
          username: true,
          name: true,
          country: true,
          city: true,
          completedAt: true,
          lastActiveAt: true,
        },
      },
      deviceFingerprints: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { ip: true, userAgent: true, updatedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const byProfileCountry: Record<string, number> = {};
  const byIpMarket: Record<IpMarketGuess, number> = {
    de: 0,
    ro: 0,
    other: 0,
    unknown: 0,
  };

  const rows = users.map((u) => {
    const ip = u.deviceFingerprints[0]?.ip ?? null;
    const ipMarket = guessIpMarket(ip);
    const profileCountry = profileCountryBucket(u.profile?.country);
    byProfileCountry[profileCountry] = (byProfileCountry[profileCountry] || 0) + 1;
    byIpMarket[ipMarket] += 1;
    return {
      id: u.id,
      email: u.email,
      username: u.profile?.username || u.profile?.name || null,
      createdAt: u.createdAt.toISOString(),
      lastActiveAt: u.profile?.lastActiveAt?.toISOString() ?? null,
      countryRaw: u.profile?.country ?? null,
      profileCountry,
      city: u.profile?.city ?? null,
      completed: !!u.profile?.completedAt,
      isBanned: u.isBanned,
      ip,
      ipMarket,
      ipMarketLabel: ipMarketLabel(ipMarket),
    };
  });

  const filtered =
    marketFilter === "de" || marketFilter === "ro" || marketFilter === "other" || marketFilter === "unknown"
      ? rows.filter((r) => r.ipMarket === marketFilter)
      : marketFilter === "profile-de"
        ? rows.filter((r) => r.profileCountry === "Germania")
        : marketFilter === "profile-ro"
          ? rows.filter((r) => r.profileCountry === "România")
          : marketFilter === "no-country"
            ? rows.filter((r) => r.profileCountry === "(fără țară)")
            : rows;

  const profileCountrySorted = Object.entries(byProfileCountry)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  const totalAll = await prisma.user.count();
  const emptyCountryAll = await prisma.profile.count({
    where: { OR: [{ country: null }, { country: "" }] },
  });

  return NextResponse.json({
    days,
    since: since.toISOString(),
    totals: {
      signupsInWindow: users.length,
      totalUsers: totalAll,
      emptyCountryAll,
      byIpMarket: {
        de: byIpMarket.de,
        ro: byIpMarket.ro,
        other: byIpMarket.other,
        unknown: byIpMarket.unknown,
      },
      byProfileCountry: profileCountrySorted,
    },
    users: filtered.slice(0, 300),
    note:
      "Țara din profil = ce a scris userul. IP = estimare pieță (prefix), nu GeoIP exact. Folosește ambele ca să vezi dacă ads DE aduce oameni.",
  });
}
