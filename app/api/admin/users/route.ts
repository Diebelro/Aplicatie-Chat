import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaGetUsersForAdmin } from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  try {
    const users = await prismaGetUsersForAdmin(search);
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
