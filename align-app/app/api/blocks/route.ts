import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaListUsersIBlocked } from "@/lib/repo-prisma";

/** Lista utilizatorilor blocați de utilizatorul curent (pentru meniu chat / setări). */
export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) {
    return NextResponse.json({ blocked: [] });
  }
  try {
    const blocked = await prismaListUsersIBlocked(userId);
    return NextResponse.json({ blocked });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
