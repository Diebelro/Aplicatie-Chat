import { NextRequest, NextResponse } from "next/server";
import { getFriendStatus } from "@/lib/store";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetFriendStatus } from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = (await resolveRequestUserId(request)) ?? request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const user_id = request.nextUrl.searchParams.get("user_id");
  if (!user_id) {
    return NextResponse.json({ error: "Lipsește user_id." }, { status: 400 });
  }

  if (isPrismaAvailable()) {
    try {
      const status = await prismaGetFriendStatus(userId, user_id);
      return NextResponse.json({ status });
    } catch (e) {
      console.error("[api/friends/status] prisma", e);
    }
  }

  const status = getFriendStatus(userId, user_id);
  return NextResponse.json({ status });
}
