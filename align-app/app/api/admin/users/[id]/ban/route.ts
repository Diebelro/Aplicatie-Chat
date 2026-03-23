import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { findUserOrPrisma, isPrismaAvailable, prismaGetUserRole, prismaSetUserBanned, prismaCreateAdminLog } from "@/lib/repo-prisma";

async function requireAdmin(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  return { userId };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id: targetId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "BAN" && action !== "UNBAN") {
    return NextResponse.json({ error: "Lipsește action (BAN sau UNBAN)." }, { status: 400 });
  }
  const reason =
    typeof body?.reason === "string" ? body.reason.trim().slice(0, 4000) : "";
  const target = await findUserOrPrisma(targetId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  try {
    await prismaSetUserBanned(targetId, action === "BAN");
    await prismaCreateAdminLog(
      auth.userId,
      action === "BAN" ? "BAN_USER" : "UNBAN_USER",
      targetId,
      action === "BAN" && reason ? reason : null
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
