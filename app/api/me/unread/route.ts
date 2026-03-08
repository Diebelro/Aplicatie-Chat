import { NextRequest, NextResponse } from "next/server";
import { findUserById, getTotalUnread } from "@/lib/store";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const totalUnread = getTotalUnread(userId);
  return NextResponse.json({ totalUnread });
}
