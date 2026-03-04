import { NextRequest, NextResponse } from "next/server";
import { findUserById, activateRewarded } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const result = activateRewarded(userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Nu s-a putut activa." },
      { status: 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    premiumUntil: result.premiumUntil,
    activationsLeft: result.activationsLeft,
  });
}
