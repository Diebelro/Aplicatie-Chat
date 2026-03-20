import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/store";
import { normalizeAuthEmail } from "@/lib/auth";
import { isPrismaAvailable, prismaFindUserByEmailForLogin } from "@/lib/repo-prisma";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";

const EMAIL_MAX_LENGTH = 320;

export async function GET(request: NextRequest) {
  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, null, "/api/check-email")) {
    return NextResponse.json({ available: false }, { status: 429 });
  }
  const value = request.nextUrl.searchParams.get("value");
  if (value == null || String(value).trim() === "") {
    return NextResponse.json({ available: false });
  }
  const raw = String(value).trim();
  if (raw.length > EMAIL_MAX_LENGTH) {
    return NextResponse.json({ available: false });
  }
  const email = normalizeAuthEmail(raw);
  if (!email.includes("@") || !email.includes(".")) {
    return NextResponse.json({ available: false });
  }

  if (isPrismaAvailable()) {
    try {
      const existing = await prismaFindUserByEmailForLogin(email);
      return NextResponse.json({ available: !existing });
    } catch {
      // fallback to store
    }
  }
  const inStore = findUserByEmail(email);
  return NextResponse.json({ available: !inStore });
}
