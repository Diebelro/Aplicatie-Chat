import { NextResponse } from "next/server";
import { findUserById, getUserPosition, getOnlineUsersWithPositions, setUserActive } from "@/lib/store";
import { getProfileImageUrl } from "@/lib/profileImage";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaGetMyLocation,
  prismaGetVisibleUsersForMap,
  prismaGetFirstProfilePhotoUrl,
  prismaUpdateLastActive,
} from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

export async function GET(request: Request) {
  const userId = await resolveRequestUserId(request);
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
      const [myPos, myPhoto, users] = await Promise.all([
        prismaGetMyLocation(userId),
        prismaGetFirstProfilePhotoUrl(userId),
        prismaGetVisibleUsersForMap(userId),
      ]);
      return NextResponse.json({
        me: myPos ? { lat: myPos.lat, lng: myPos.lng, photoUrl: myPhoto } : null,
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
  const meUser = findUserById(userId);
  const myPos = getUserPosition(userId);
  const users = getOnlineUsersWithPositions(userId);
  return NextResponse.json({
    me: myPos
      ? { lat: myPos.lat, lng: myPos.lng, photoUrl: getProfileImageUrl(meUser) }
      : null,
    users,
  });
}
