import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getUserPrivacySettings,
  setUserPrivacySettings,
} from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaUpdateProfile, prismaFindUserById } from "@/lib/repo-prisma";

function settingsFromProfile(profile: { showDistance: boolean; showOnline: boolean; showProfileVisits: boolean; showReadReceipts: boolean; allowFriendRequests: boolean }) {
  return {
    allowFriendRequests: profile.allowFriendRequests,
    allowVisitVisibility: profile.showProfileVisits,
    allowReadReceipts: profile.showReadReceipts,
    show_distance: profile.showDistance,
    show_online: profile.showOnline,
  };
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const user = await findUserOrPrisma(userId);
      if (!user) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const { prisma } = await import("@/lib/db");
      const profile = await prisma.profile.findUnique({ where: { userId } });
      if (profile) {
        return NextResponse.json({
          settings: settingsFromProfile(profile),
        });
      }
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const settings = getUserPrivacySettings(userId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const patch: {
    allowFriendRequests?: boolean;
    allowVisitVisibility?: boolean;
    allowReadReceipts?: boolean;
    show_distance?: boolean;
    show_online?: boolean;
  } = {};
  if (typeof body.allowFriendRequests === "boolean") patch.allowFriendRequests = body.allowFriendRequests;
  if (typeof body.allowVisitVisibility === "boolean") patch.allowVisitVisibility = body.allowVisitVisibility;
  if (typeof body.allowReadReceipts === "boolean") patch.allowReadReceipts = body.allowReadReceipts;
  if (typeof body.show_distance === "boolean") patch.show_distance = body.show_distance;
  if (typeof body.show_online === "boolean") patch.show_online = body.show_online;

  if (isPrismaAvailable() && Object.keys(patch).length > 0) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const profileUpdate: Parameters<typeof prismaUpdateProfile>[1] = {};
      if (patch.allowFriendRequests !== undefined) profileUpdate.allowFriendRequests = patch.allowFriendRequests;
      if (patch.allowVisitVisibility !== undefined) profileUpdate.showProfileVisits = patch.allowVisitVisibility;
      if (patch.allowReadReceipts !== undefined) profileUpdate.showReadReceipts = patch.allowReadReceipts;
      if (patch.show_distance !== undefined) profileUpdate.showDistance = patch.show_distance;
      if (patch.show_online !== undefined) profileUpdate.showOnline = patch.show_online;
      if (Object.keys(profileUpdate).length > 0) await prismaUpdateProfile(userId, profileUpdate);
      const user = await prismaFindUserById(userId);
      const settings = user
        ? {
            allowFriendRequests: user.allow_friend_requests !== false,
            allowVisitVisibility: user.show_profile_visits !== false,
            allowReadReceipts: user.show_read_receipts !== false,
            show_distance: user.show_distance !== false,
            show_online: user.show_online !== false,
          }
        : patch;
      return NextResponse.json({ settings });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const settings = setUserPrivacySettings(userId, patch);
  return NextResponse.json({ settings });
}
