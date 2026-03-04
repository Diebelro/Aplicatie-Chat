import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaGetAdminLogs } from "@/lib/repo-prisma";

async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const err = await requireAdmin(request);
  if (err) return err;
  try {
    const logs = await prismaGetAdminLogs();
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
