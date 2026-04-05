import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LEGACY = ["google", "apple", "microsoft", "facebook", "phone", "yahoo"];

/**
 * Entrypoint vechi /api/auth/google etc. — mutat sub /api/auth/legacy/:provider
 * ca să nu clădească ruta dinamică [provider] peste /api/auth/session (NextAuth).
 */
const NEXT_AUTH_SLUG: Record<string, string> = {
  google: "google",
  apple: "apple",
  facebook: "facebook",
  microsoft: "azure-ad",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!provider || !LEGACY.includes(provider)) {
    return NextResponse.json({ error: "Provider necunoscut" }, { status: 400 });
  }
  const slug = NEXT_AUTH_SLUG[provider];
  if (slug) {
    const callbackUrl = new URL("/api/auth/align-bridge", request.url).toString();
    const signin = new URL(`/api/auth/signin/${slug}`, request.url);
    signin.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(signin);
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("auth", provider);
  url.searchParams.set("soon", "1");
  return NextResponse.redirect(url);
}
