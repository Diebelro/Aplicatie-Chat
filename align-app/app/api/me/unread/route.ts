import { NextRequest, NextResponse } from "next/server";
import { findUserById, getTotalUnread } from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaGetTotalUnread } from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const totalUnread = await prismaGetTotalUnread(userId);
      return NextResponse.json({ totalUnread });
    } catch {
      return NextResponse.json({ totalUnread: 0 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const totalUnread = getTotalUnread(userId);
  return NextResponse.json({ totalUnread });
}
