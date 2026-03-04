import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPasswordHash, deleteUser } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/sessions";

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const password = body?.password;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Introdu parola pentru a confirma ștergerea contului." }, { status: 400 });
  }
  const hash = getPasswordHash(userId);
  if (!hash || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Parolă incorectă." }, { status: 401 });
  }
  const deleted = deleteUser(userId);
  if (!deleted) {
    return NextResponse.json({ error: "Nu s-a putut șterge contul." }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
