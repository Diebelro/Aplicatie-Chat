import { NextResponse } from "next/server";
import { findUserById, getUserPosition, getOnlineUsersWithPositions, setUserActive } from "@/lib/store";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaGetMyLocation,
  prismaGetVisibleUsersForMap,
  prismaUpdateLastActive,
} from "@/lib/repo-prisma";

export async function GET(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({
          me: null,
          users: [],
          sessionExpired: true,
          error: "Sesiunea a expirat. Ieși și conectează-te din nou.",
        });
      }
      await prismaUpdateLastActive(userId);
      const myPos = await prismaGetMyLocation(userId);
      const users = await prismaGetVisibleUsersForMap(userId);
      return NextResponse.json({
        me: myPos ? { lat: myPos.lat, lng: myPos.lng } : null,
        users,
      });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  const me = findUserById(userId);
  if (!me) {
    return NextResponse.json({
      me: null,
      users: [],
      sessionExpired: true,
      error: "Sesiunea a expirat. Ieși și conectează-te din nou.",
    });
  }
  setUserActive(userId);
  const myPos = getUserPosition(userId);
  const users = getOnlineUsersWithPositions(userId);
  return NextResponse.json({
    me: myPos ? { lat: myPos.lat, lng: myPos.lng } : null,
    users,
  });
}
