import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole } from "@/lib/repo-prisma";
import { getAdminSystemSnapshot } from "@/lib/systemHealth";
import { recordApiRouteError } from "@/lib/serverErrorRing";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) {
    return NextResponse.json(
      { error: "Bordul sistem necesită DATABASE_URL configurat pe server." },
      { status: 503 }
    );
  }

  try {
    const role = await prismaGetUserRole(userId);
    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
    }
    const snap = await getAdminSystemSnapshot();
    return NextResponse.json(snap);
  } catch (e) {
    recordApiRouteError("GET /api/admin/system-status", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare snapshot" },
      { status: 500 }
    );
  }
}
