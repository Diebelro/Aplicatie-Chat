import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaGetUserRole,
  prismaAdminListRecentConversations,
} from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const search = sp.get("q")?.trim() || undefined;
  const forUserId = sp.get("userId")?.trim() || undefined;
  const limitRaw = Number(sp.get("limit") || "40");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 40;
  const hasPhotos = sp.get("hasPhotos") === "1" || sp.get("hasPhotos") === "true";
  const flaggedOnly = sp.get("flagged") === "1" || sp.get("flagged") === "true";
  const category = sp.get("category")?.trim() || undefined;

  try {
    const conversations = await prismaAdminListRecentConversations({
      limit,
      search,
      forUserId,
      hasPhotos,
      flaggedOnly,
      category,
    });
    return NextResponse.json({ conversations });
  } catch (e) {
    console.error("[admin/conversations]", e);
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
