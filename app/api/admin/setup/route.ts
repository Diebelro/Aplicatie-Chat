import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import {
  isPrismaAvailable,
  prismaFindUserByEmail,
  prismaGetPasswordHash,
  prismaHasAnyAdmin,
  prismaSetUserRole,
  prismaCreateAdminLog,
} from "@/lib/repo-prisma";

/**
 * Configurează primul cont admin: email + parolă (cont existent).
 * Funcționează doar dacă nu există niciun user cu rol ADMIN sau SUPERADMIN.
 */
export async function POST(request: NextRequest) {
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Baza de date nu este disponibilă." }, { status: 503 });
  }
  const hasAdmin = await prismaHasAnyAdmin();
  if (hasAdmin) {
    return NextResponse.json(
      { error: "Există deja un cont admin. Loghează-te cu acel cont." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = body?.password;

  if (!email) {
    return NextResponse.json({ error: "Lipsește email-ul." }, { status: 400 });
  }
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Lipsește parola." }, { status: 400 });
  }

  const user = await prismaFindUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "Nu există cont cu acest email. Înregistrează-te mai întâi la /signup." },
      { status: 404 }
    );
  }

  const hash = await prismaGetPasswordHash(user.id);
  if (!hash || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Parolă incorectă." }, { status: 401 });
  }

  try {
    await prismaSetUserRole(user.id, "ADMIN");
    await prismaCreateAdminLog(user.id, "SETUP_FIRST_ADMIN", user.id);
    return NextResponse.json({
      ok: true,
      message: "Contul tău a fost făcut admin. Loghează-te acum cu acest email și parolă.",
    });
  } catch {
    return NextResponse.json({ error: "Eroare la setarea rolului." }, { status: 500 });
  }
}
