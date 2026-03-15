import { NextRequest, NextResponse } from "next/server";
import { isUsernameTaken } from "@/lib/store";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";

const USERNAME_MIN = 2;
const USERNAME_MAX = 30;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;

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

  const username = String(value).trim();
  if (username.length < USERNAME_MIN) {
    return NextResponse.json({ available: false, error: "Username-ul trebuie să aibă cel puțin 2 caractere." });
  }
  if (username.length > USERNAME_MAX) {
    return NextResponse.json({ available: false, error: "Username-ul poate avea maximum 30 de caractere." });
  }
  if (!USERNAME_REGEX.test(username)) {
    return NextResponse.json({
      available: false,
      error: "Doar litere, cifre, punct și liniuță jos.",
    });
  }

  const taken = isUsernameTaken(username, excludeUserId);
  return NextResponse.json({ available: !taken });
}
