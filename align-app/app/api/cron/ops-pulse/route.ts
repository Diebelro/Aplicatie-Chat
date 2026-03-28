import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAdminSystemSnapshot } from "@/lib/systemHealth";

export const dynamic = "force-dynamic";

function cronSecret(): string | undefined {
  return process.env.OPS_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
}

function authorizeCron(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const q = new URL(request.url).searchParams.get("secret");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : q?.trim() ?? "";
  if (!provided || provided.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    return false;
  }
}

/**
 * Apel periodic (ex. Vercel Cron) pentru snapshot + webhook la critical fără să ai admin deschis.
 * GET cu Authorization: Bearer OPS_CRON_SECRET sau ?secret=
 */
export async function GET(request: Request) {
  if (!cronSecret()) {
    return NextResponse.json(
      { error: "OPS_CRON_SECRET sau CRON_SECRET neconfigurat." },
      { status: 503 }
    );
  }
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  try {
    const snap = await getAdminSystemSnapshot();
    return NextResponse.json({
      ok: true,
      overall: snap.overall,
      generatedAt: snap.generatedAt,
    });
  } catch {
    return NextResponse.json({ error: "Eroare snapshot." }, { status: 500 });
  }
}
