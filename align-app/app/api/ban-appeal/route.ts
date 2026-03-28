import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, normalizeAuthEmail } from "@/lib/auth";
import {
  isPrismaAvailable,
  prismaCreateBanAppeal,
  prismaFindUserByEmailForLogin,
  prismaGetPasswordHash,
} from "@/lib/repo-prisma";

const ONE_HOUR = 60 * 60 * 1000;
const MAX_APPEALS_PER_HOUR = 8;
const appealTimestampsByIp = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function appealRateOk(ip: string): boolean {
  const cutoff = Date.now() - ONE_HOUR;
  const list = (appealTimestampsByIp.get(ip) ?? []).filter((t) => t > cutoff);
  if (list.length >= MAX_APPEALS_PER_HOUR) return false;
  list.push(Date.now());
  appealTimestampsByIp.set(ip, list);
  return true;
}

export async function POST(request: NextRequest) {
  if (!isPrismaAvailable()) {
    return NextResponse.json({ error: "Serviciu indisponibil fără bază de date." }, { status: 503 });
  }

  const ip = getClientIp(request);
  if (!appealRateOk(ip)) {
    return NextResponse.json({ error: "Prea multe cereri. Încearcă mai târziu." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeAuthEmail(String(body?.email ?? ""));
  const password = body?.password != null ? String(body.password) : "";
  const message = body?.message != null ? String(body.message) : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Introdu emailul contului." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Introdu parola." }, { status: 400 });
  }

  try {
    const row = await prismaFindUserByEmailForLogin(email);
    if (!row) {
      return NextResponse.json({ error: "Email sau parolă incorectă." }, { status: 401 });
    }
    const hash = await prismaGetPasswordHash(row.id);
    if (!hash || !verifyPassword(password, hash)) {
      return NextResponse.json({ error: "Email sau parolă incorectă." }, { status: 401 });
    }
    if (!row.isBanned) {
      return NextResponse.json({ error: "Contul tău nu este blocat. Poți te loga normal." }, { status: 400 });
    }

    const created = await prismaCreateBanAppeal(row.id, message);
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
