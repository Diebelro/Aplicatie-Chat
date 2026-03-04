import { NextRequest, NextResponse } from "next/server";
import { findUserById, clearPendingCall } from "@/lib/store";

/** Încheie apelul: curăță apelul în așteptare pentru utilizatorul curent (dacă există). */
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  clearPendingCall(userId);
  return NextResponse.json({ ok: true });
}
