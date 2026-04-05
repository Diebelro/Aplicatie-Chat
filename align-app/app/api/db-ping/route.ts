import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/productionHealthz";

/** Ping DB minimal pentru monitorizare; fără stack traces în body. */
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await pingDatabase();
  if (r.dbOk) {
    return NextResponse.json({ dbOk: true, ms: r.ms });
  }
  return NextResponse.json({ dbOk: false, error: r.error }, { status: 503 });
}
