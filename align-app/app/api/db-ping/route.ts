import { NextResponse } from "next/server";

/** Ping DB minimal pentru monitorizare; fără stack traces în body. Mereu HTTP 200 pentru Preview/monitori. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { pingDatabase } = await import("@/lib/productionHealthz");
    const r = await pingDatabase();
    if (r.dbOk) {
      return NextResponse.json({ ok: true, dbOk: true, ms: r.ms });
    }
    return NextResponse.json({ ok: false, dbOk: false, error: r.error }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, dbOk: false, error: "DB_PING_FAILED" }, { status: 200 });
  }
}
