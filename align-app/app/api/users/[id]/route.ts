import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  isUserOnline,
  getDistanceKm,
  getFriendStatus,
  getLastActivityAt,
  hasBeenVisitedBy,
  hasVisited,
  getUserPrivacySettings,
} from "@/lib/store";
import { findUserOrPrisma, isPrismaAvailable, prismaGetFriendStatus } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

const ONLINE_MS = 60 * 1000; // sub 1 min = instant ca WhatsApp

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meId = await resolveRequestUserId(request);
  if (!meId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const fullUser = await findUserOrPrisma(id);
  if (!fullUser) {
    return NextResponse.json({ error: "Profil negăsit." }, { status: 404 });
  }
  if (meId === id) {
    return NextResponse.json({ user: fullUser });
  }
  // Profil public: fără date de cont (email) pentru alți utilizatori.
  const { email: _email, email_verified: _emailVerified, ...user } = fullUser as typeof fullUser & { email?: string; email_verified?: boolean };
  void _email;
  void _emailVerified;
  const theirPrivacy = getUserPrivacySettings(id);
  const visitedByThem = theirPrivacy?.allowVisitVisibility ? hasBeenVisitedBy(meId, id) : undefined;
  const online = user.last_active != null && Date.now() - user.last_active < ONLINE_MS;
  let friendStatus = getFriendStatus(meId, id);
  if (isPrismaAvailable()) {
    try {
      friendStatus = await prismaGetFriendStatus(meId, id);
    } catch (e) {
      console.error("[api/users/[id]] friendStatus", e);
    }
  }
  const payload = {
    ...user,
    online: findUserById(id) ? isUserOnline(id) : online,
    distanceKm: getDistanceKm(meId, id) ?? undefined,
    lastActivityAt: findUserById(id) ? getLastActivityAt(id) : (user.last_active ?? undefined),
    friendStatus,
    visitedByThem: visitedByThem ?? false,
    visited: hasVisited(meId, id),
  };
  return NextResponse.json({ user: payload });
}
