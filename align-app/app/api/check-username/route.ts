import { NextRequest, NextResponse } from "next/server";
import { isUsernameTaken } from "@/lib/store";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";
import { validateUsername, usernameErrorMessage } from "@/lib/usernamePolicy";
import { isPrismaAvailable, prismaFindUserByUsername } from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, null, "/api/check-username")) {
    return NextResponse.json({ available: false }, { status: 429 });
  }
  const value = request.nextUrl.searchParams.get("value");
  const excludeUserId = request.nextUrl.searchParams.get("excludeUserId") ?? undefined;

  if (value == null || String(value).trim() === "") {
    return NextResponse.json({ available: false, error: "Lipsește username-ul." });
  }

  const checked = validateUsername(String(value));
  if (!checked.ok) {
    return NextResponse.json({
      available: false,
      error: usernameErrorMessage(checked.reason),
    });
  }

  let taken = isUsernameTaken(checked.value, excludeUserId);
  if (isPrismaAvailable()) {
    const existing = await prismaFindUserByUsername(checked.value);
    taken = !!(existing && existing.id !== excludeUserId);
  }
  return NextResponse.json({ available: !taken });
}
