import { NextRequest, NextResponse } from "next/server";
import { findUserById, getMutualMatches, isUserOnlineVisible, getDistanceKmForDisplay } from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaGetMutualMatches, prismaGetMyLocation } from "@/lib/repo-prisma";

const ONLINE_MS = 60 * 1000; // sub 1 min = instant ca WhatsApp

function distanceHaversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const list = await prismaGetMutualMatches(userId);
      const myLoc = await prismaGetMyLocation(userId);
      const matches = list.map((u) => {
        const hasLocation = u.latitude != null && u.longitude != null;
        const showDistance = u.show_distance !== false && hasLocation;
        const distanceKm =
          myLoc && hasLocation && showDistance && u.latitude != null && u.longitude != null
            ? distanceHaversine(myLoc.lat, myLoc.lng, u.latitude, u.longitude)
            : null;
        const lastActive = u.last_active ?? null;
        const online = lastActive != null && Date.now() - lastActive < ONLINE_MS;
        return {
          ...u,
          online,
          distanceKm: distanceKm != null ? distanceKm : undefined,
          distanceHidden: distanceKm === null,
        };
      });
      return NextResponse.json({ matches });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const list = getMutualMatches(userId);
  const matches = list.map((u) => {
    const distanceKm = getDistanceKmForDisplay(userId, u.id);
    return {
      ...u,
      online: isUserOnlineVisible(u.id),
      distanceKm: distanceKm != null ? distanceKm : undefined,
      distanceHidden: distanceKm === null,
    };
  });
  return NextResponse.json({ matches });
}
