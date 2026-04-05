import { NextResponse } from "next/server";
import { getProductionHealthzSnapshot } from "@/lib/productionHealthz";

/** Răspuns JSON only — fără loguri cu valori din env. */
export const dynamic = "force-dynamic";

export async function GET() {
  const body = await getProductionHealthzSnapshot();
  return NextResponse.json(body);
}
