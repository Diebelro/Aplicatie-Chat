import { NextRequest, NextResponse } from "next/server";
import { findUserById, getPasswordHash, setPassword } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { isPrismaAvailable, findUserOrPrisma, prismaGetPasswordHash, prismaUpdatePassword } from "@/lib/repo-prisma";

export async function PATCH(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const oldPassword = body?.oldPassword;
  const newPassword = body?.newPassword;
  if (!oldPassword || typeof oldPassword !== "string") {
    return NextResponse.json({ error: "Lipsește parola curentă." }, { status: 400 });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "Parola nouă trebuie să aibă cel puțin 8 caractere." }, { status: 400 });
  }
  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const hash = await prismaGetPasswordHash(userId);
      if (!hash || !verifyPassword(oldPassword, hash)) {
        return NextResponse.json({ error: "Parola curentă este incorectă." }, { status: 401 });
      }
      await prismaUpdatePassword(userId, hashPassword(newPassword));
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const hash = getPasswordHash(userId);
  if (!hash || !verifyPassword(oldPassword, hash)) {
    return NextResponse.json({ error: "Parola curentă este incorectă." }, { status: 401 });
  }
  setPassword(userId, hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
