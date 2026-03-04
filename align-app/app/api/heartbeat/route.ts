import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserActive } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

/** Apelat la fiecare ~8–10s cât timp utilizatorul e pe site → online în timp real. */
export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  setUserActive(userId);
  return NextResponse.json({ ok: true });
}
