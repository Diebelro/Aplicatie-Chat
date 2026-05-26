import { NextRequest, NextResponse } from "next/server";
import { addVisit, findUserById } from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaAddVisit } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, userId, "/api/visit")) {
    return NextResponse.json(
      { error: "Prea multe cereri. Încearcă mai târziu." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  const body = await request.json();
  const profileId = body?.profileId;
  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json(
      { error: "Lipsește profileId." },
      { status: 400 }
    );
  }
  if (profileId === userId) {
    return NextResponse.json({ ok: true });
  }
  if (isPrismaAvailable()) {
    try {
      const viewer = await findUserOrPrisma(userId);
      if (viewer?.show_profile_visits === false) {
        return NextResponse.json({ ok: true });
      }
      const visited = await findUserOrPrisma(profileId);
      if (!visited || visited.show_profile_visits === false) {
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
  const visited = findUserById(profileId);
  if (!visited || visited.show_profile_visits === false) {
    return NextResponse.json({ ok: true });
  }
  addVisit(userId, profileId);
  return NextResponse.json({ ok: true });
}
