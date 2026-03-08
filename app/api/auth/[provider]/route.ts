import { NextRequest, NextResponse } from "next/server";

const ALLOWED = ["google", "apple", "microsoft", "facebook", "phone", "yahoo"];

/** Stub pentru OAuth / SMS: redirecționează înapoi la login. Conectează aici providerii când sunt configurați. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (!provider || !ALLOWED.includes(provider)) {
    return NextResponse.json({ error: "Provider necunoscut" }, { status: 400 });
  }
  // TODO: inițiază OAuth flow sau SMS; deocamdată redirecționare la login
  const url = new URL("/login", _request.url);
  url.searchParams.set("auth", provider);
  url.searchParams.set("soon", "1");
  return NextResponse.redirect(url);
}
