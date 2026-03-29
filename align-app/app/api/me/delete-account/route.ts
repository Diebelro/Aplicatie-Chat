import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPasswordHash, deleteUser } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/sessions";
import { isPrismaAvailable, findUserOrPrisma } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";
import { deleteAllSessionsForUser } from "@/lib/sessions";
import { deleteDevicesForUser } from "@/lib/devices";

/** Ștergere cont doar la cererea utilizatorului (parolă confirmată). Nicio ștergere automată. */
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const password = body?.password;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Introdu parola pentru a confirma ștergerea contului." }, { status: 400 });
  }

  let passwordHash: string | null = null;
  const inStore = findUserById(userId);
  if (inStore) {
    passwordHash = getPasswordHash(userId) ?? null;
  }
  if (!passwordHash && isPrismaAvailable()) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      passwordHash = u?.passwordHash ?? null;
    } catch {
      // ignore
    }
  }

  if (!passwordHash || !verifyPassword(password, passwordHash)) {
    return NextResponse.json({ error: "Parolă incorectă." }, { status: 401 });
  }

  const existsInPrisma = isPrismaAvailable() && (await findUserOrPrisma(userId));
  if (!inStore && !existsInPrisma) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }

  if (existsInPrisma) {
    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch {
      return NextResponse.json({ error: "Nu s-a putut șterge contul." }, { status: 500 });
    }
    await deleteAllSessionsForUser(userId);
    deleteDevicesForUser(userId);
  }
  if (inStore) {
    const deleted = deleteUser(userId);
    if (!deleted && !existsInPrisma) {
      return NextResponse.json({ error: "Nu s-a putut șterge contul." }, { status: 500 });
    }
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
