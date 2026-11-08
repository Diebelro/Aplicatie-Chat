import { NextRequest, NextResponse } from "next/server";

function allowed(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host === "diebel.ro" || host.endsWith(".diebel.ro");
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u") || "";
  const dest = allowed(target) ? target : "https://ads.diebel.ro/campanie/nou";
  return NextResponse.redirect(dest, 302);
}
