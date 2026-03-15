/**
 * DEV ONLY: șterge un user după email (fără auth, cu confirm și rate limit).
 * GET /api/dev/delete-user?email=...&confirm=DELETE
 * Politică: doar email (lowercased) === "contact@diebel.ro".
 */
import { NextRequest, NextResponse } from "next/server";
import { isPrismaAvailable } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const devDeleteTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  while (devDeleteTimestamps.length > 0 && devDeleteTimestamps[0] < cutoff) {
    devDeleteTimestamps.shift();
  }
  return devDeleteTimestamps.length >= RATE_LIMIT_MAX;
}

function recordRequest(): void {
  devDeleteTimestamps.push(Date.now());
}

const ALLOWED_EMAIL = "contact@diebel.ro";
const EMAIL_PARAM_MAX_LENGTH = 320;

function isEmailAllowed(email: string): boolean {
  return email === ALLOWED_EMAIL;
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const emailRaw = (request.nextUrl.searchParams.get("email") ?? "").trim();
  if (emailRaw.length > EMAIL_PARAM_MAX_LENGTH) {
    return NextResponse.json({ error: "Email invalid." }, { status: 400 });
  }
  const email = emailRaw.toLowerCase();
  const confirm = request.nextUrl.searchParams.get("confirm") ?? "";

  if (!email || !email.includes("@") || !email.includes(".")) {
    return NextResponse.json(
      { error: "Lipsește sau invalid: email. Exemplu: ?email=contact@diebel.ro&confirm=DELETE" },
      { status: 400 }
    );
  }
  if (confirm !== "DELETE") {
    return NextResponse.json(
      { error: "Lipsește confirm=DELETE. Exemplu: ?email=...&confirm=DELETE" },
      { status: 400 }
    );
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      { error: "Doar contact@diebel.ro este permis." },
      { status: 403 }
    );
  }
  if (isRateLimited()) {
    return NextResponse.json(
      { error: "Prea multe cereri. Max 5 pe minut. Încearcă mai târziu." },
      { status: 429 }
    );
  }

  if (!isPrismaAvailable()) {
    return NextResponse.json(
      { error: "DATABASE_URL nu e setat." },
      { status: 503 }
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Nu există cont cu acest email." },
        { status: 200 }
      );
    }
    await prisma.user.delete({ where: { id: user.id } });
    recordRequest();
    return NextResponse.json({
      ok: true,
      message: `Cont ${email} a fost șters. Poți crea unul nou.`,
    });
  } catch (e) {
    console.error("[dev delete-user]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Eroare la ștergere." },
      { status: 500 }
    );
  }
}
