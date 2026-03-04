import { NextRequest, NextResponse } from "next/server";
import { getFriendStatus } from "@/lib/store";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const user_id = request.nextUrl.searchParams.get("user_id");
  if (!user_id) {
    return NextResponse.json({ error: "Lipsește user_id." }, { status: 400 });
  }
  const status = getFriendStatus(userId, user_id);
  return NextResponse.json({ status });
}
