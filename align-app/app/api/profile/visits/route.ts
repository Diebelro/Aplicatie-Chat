import { NextRequest, NextResponse } from "next/server";
import { isPrismaAvailable, prismaListVisibleProfileVisits } from "@/lib/repo-prisma";
import { listProfileVisitsFromMemory } from "@/lib/store";
import { resolveRequestUserId } from "@/lib/sessionAuth";

export async function GET(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  try {
    if (isPrismaAvailable()) {
      const { listEnabled, visits } = await prismaListVisibleProfileVisits(userId);
      return NextResponse.json({ listEnabled, visits });
    }
    const { listEnabled, visits } = listProfileVisitsFromMemory(userId);
    return NextResponse.json({ listEnabled, visits });
  } catch {
    return NextResponse.json({ error: "Eroare la încărcarea vizitelor." }, { status: 500 });
  }
}
