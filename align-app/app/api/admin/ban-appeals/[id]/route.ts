import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaResolveBanAppealAsAdmin } from "@/lib/repo-prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthenticatedUserId(request);
  if (!adminId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(adminId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action === "UNBAN" ? "UNBAN" : body?.action === "DISMISS" ? "DISMISS" : null;
  if (!action) {
    return NextResponse.json({ error: "action trebuie să fie UNBAN sau DISMISS." }, { status: 400 });
  }

  const result = await prismaResolveBanAppealAsAdmin(id, action, adminId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
