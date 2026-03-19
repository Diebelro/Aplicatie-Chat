import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserActive } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, findUserOrPrisma, prismaUpdateLastActive } from "@/lib/repo-prisma";

/** Apelat la fiecare ~5s cât timp utilizatorul e pe site → online în timp real. */
export async function POST(request: NextRequest) {
  let userId = getAuthenticatedUserId(request);
  if (!userId && isPrismaAvailable()) {
    const headerId = request.headers.get("x-user-id")?.trim();
    if (headerId) {
      const user = await findUserOrPrisma(headerId);
      if (user) userId = headerId;
    }
  }
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      await prismaUpdateLastActive(userId);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  setUserActive(userId);
  return NextResponse.json({ ok: true });
}
