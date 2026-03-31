import { NextResponse } from "next/server";
import { findUserById, getMapVisibleUsers, getUserPosition, setUserActive } from "@/lib/store";
import { getProfileImageUrl } from "@/lib/profileImage";
import {
  isPrismaAvailable,
  findUserOrPrisma,
  prismaGetMyMapLocation,
  prismaGetFirstProfilePhotoUrl,
  prismaGetVisibleUsersForMap,
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
      const [myLoc, myPhoto, users] = await Promise.all([
        prismaGetMyMapLocation(userId),
        prismaGetFirstProfilePhotoUrl(userId),
        prismaGetVisibleUsersForMap(userId),
      ]);
      const now = Date.now();
      const meOut = myLoc
        ? {
            lat: myLoc.lat,
            lng: myLoc.lng,
            photoUrl: myPhoto,
            mapVisibleUntil:
              myLoc.mapVisibleUntil && new Date(myLoc.mapVisibleUntil).getTime() > now
                ? myLoc.mapVisibleUntil
                : null,
          }
        : null;
      return NextResponse.json({ me: meOut, users });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  const meUser = findUserById(userId);
  if (!meUser) {
    return NextResponse.json({
      me: null,
      users: [],
      sessionExpired: true,
      error: "Sesiunea a expirat. Ieși și conectează-te din nou.",
    });
  }
  setUserActive(userId);
  const mePos = getUserPosition(userId);
  const untilMs = meUser.map_visible_until;
  const me = mePos
    ? {
        lat: mePos.lat,
        lng: mePos.lng,
        photoUrl: getProfileImageUrl(meUser),
        mapVisibleUntil:
          untilMs != null && untilMs > Date.now() ? new Date(untilMs).toISOString() : null,
      }
    : null;
  const users = getMapVisibleUsers(userId);
  return NextResponse.json({ me, users });
}
