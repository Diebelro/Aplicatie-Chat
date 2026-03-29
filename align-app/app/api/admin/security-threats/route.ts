import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole } from "@/lib/repo-prisma";
import { getSecurityThreatsSnapshot } from "@/lib/securityThreats";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) {
    return NextResponse.json(
      { error: "Monitorul securitate necesită DATABASE_URL configurat pe server." },
      { status: 503 }
    );
  }
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const windowMin = Math.min(120, Math.max(5, Number(searchParams.get("windowMin")) || 15));
  const snap = getSecurityThreatsSnapshot(windowMin * 60 * 1000);
  return NextResponse.json({
    ...snap,
    windowMinutes: windowMin,
  });
}
