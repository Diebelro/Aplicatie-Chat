import { NextResponse } from "next/server";

/** Răspuns JSON only — fără loguri cu valori din env. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { getProductionHealthzSnapshot } = await import("@/lib/productionHealthz");
    const body = await getProductionHealthzSnapshot();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { ok: false, dbOk: false, error: "HEALTHZ_UNAVAILABLE" },
      { status: 200 }
    );
  }
}
