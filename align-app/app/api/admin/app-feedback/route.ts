import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetUserRole, prismaListAppFeedback } from "@/lib/repo-prisma";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(20, Number(searchParams.get("limit")) || 200));
    const items = await prismaListAppFeedback(limit);
    return NextResponse.json({
      items: items.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
