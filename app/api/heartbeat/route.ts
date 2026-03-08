import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserActive } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaUpdateLastActive } from "@/lib/repo-prisma";

/** Apelat la fiecare ~5s cât timp utilizatorul e pe site → online în timp real. */
export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
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
