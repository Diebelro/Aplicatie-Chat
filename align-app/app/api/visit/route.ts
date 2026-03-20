import { NextRequest, NextResponse } from "next/server";
import { addVisit, findUserById } from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaAddVisit } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";

export async function POST(request: NextRequest) {
  const userId = resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json();
  const profileId = body?.profileId;
  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json(
      { error: "Lipsește profileId." },
      { status: 400 }
    );
  }
  if (isPrismaAvailable()) {
    try {
      const viewer = await findUserOrPrisma(userId);
      if (viewer?.show_profile_visits === false) {
        return NextResponse.json({ ok: true });
      }
      await prismaAddVisit(userId, profileId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: true });
    }
  }
  const viewer = findUserById(userId);
  if (viewer?.show_profile_visits === false) {
    return NextResponse.json({ ok: true });
  }
  addVisit(userId, profileId);
  return NextResponse.json({ ok: true });
}
