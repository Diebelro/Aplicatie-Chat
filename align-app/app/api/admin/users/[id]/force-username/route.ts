import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { prisma } from "@/lib/db";
import { findUserOrPrisma, isPrismaAvailable, prismaCreateAdminLog, prismaGetUserRole } from "@/lib/repo-prisma";
import { bioLooksObscene } from "@/lib/usernamePolicy";

async function requireAdmin(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }
  return { userId };
}

/** Admin: cere schimbare username (contul rămâne). Opțional golește bio-ul vulgar. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: targetId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "REQUIRE" && action !== "CLEAR") {
    return NextResponse.json({ error: "Lipsește action (REQUIRE sau CLEAR)." }, { status: 400 });
  }
  const target = await findUserOrPrisma(targetId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  if (targetId === auth.userId) {
    return NextResponse.json({ error: "Nu poți aplica asta pe propriul cont." }, { status: 400 });
  }

  try {
    if (action === "CLEAR") {
      await prisma.user.update({
        where: { id: targetId },
        data: { mustChangeUsername: false },
      });
      await prismaCreateAdminLog(auth.userId, "CLEAR_USERNAME_CHANGE", targetId, null);
      return NextResponse.json({ ok: true, mustChangeUsername: false });
    }

    const bio = String(target.bio ?? "");
    const clearBio = bioLooksObscene(bio);
    await prisma.user.update({
      where: { id: targetId },
      data: { mustChangeUsername: true },
    });
    if (clearBio) {
      await prisma.profile.updateMany({
        where: { userId: targetId },
        data: { bio: "" },
      });
    }
    const detail = clearBio ? "username + bio vulgar golit" : "username";
    await prismaCreateAdminLog(auth.userId, "REQUIRE_USERNAME_CHANGE", targetId, detail);
    return NextResponse.json({ ok: true, mustChangeUsername: true, bioCleared: clearBio });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
