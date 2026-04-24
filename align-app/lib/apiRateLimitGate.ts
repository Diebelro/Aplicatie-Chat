import { NextResponse } from "next/server";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";

/** Mesaj generic; UI folosește translateApiError unde e cazul. */
const RATE_BODY = { error: "Prea multe cereri. Încearcă mai târziu." };

/**
 * Rate limit strict pe IP pentru rute anonime sau pre-auth (login are logică separată).
 * Returnează 429 sau null dacă e OK.
 */
export function enforceIpRateLimit(request: Request, pathname: string): NextResponse | null {
  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, null, pathname)) {
    return NextResponse.json(RATE_BODY, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  return null;
}
