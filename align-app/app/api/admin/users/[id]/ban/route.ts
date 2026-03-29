import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { prisma } from "@/lib/db";
import { findUserOrPrisma, isPrismaAvailable, prismaGetUserRole, prismaCreateAdminLog } from "@/lib/repo-prisma";

async function requireAdmin(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = await getAuthenticatedUserId(request);
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
  if (action !== "BAN" && action !== "UNBAN" && action !== "SUSPEND") {
    return NextResponse.json({ error: "Lipsește action (BAN, UNBAN sau SUSPEND)." }, { status: 400 });
  }
  const reason =
    typeof body?.reason === "string" ? body.reason.trim().slice(0, 4000) : "";
  const target = await findUserOrPrisma(targetId);
  if (!target) return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  try {
    if (action === "SUSPEND") {
      const hours = Number(body?.hours);
      if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
        return NextResponse.json({ error: "hours trebuie să fie între 1 și 168 (7 zile)." }, { status: 400 });
      }
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: targetId },
        data: { isBanned: true, banUntil: until },
      });
      const detail = `${hours}h suspendare până la ${until.toISOString()}${reason ? ` — ${reason}` : ""}`;
      await prismaCreateAdminLog(auth.userId, "SUSPEND_USER", targetId, detail.slice(0, 4000));
      return NextResponse.json({ ok: true, banUntil: until.toISOString() });
    }
    if (action === "UNBAN") {
      await prisma.user.update({
        where: { id: targetId },
        data: { isBanned: false, banUntil: null },
      });
      await prismaCreateAdminLog(auth.userId, "UNBAN_USER", targetId, reason || null);
    } else {
      await prisma.user.update({
        where: { id: targetId },
        data: { isBanned: true, banUntil: null },
      });
      await prismaCreateAdminLog(auth.userId, "BAN_USER", targetId, reason || null);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
