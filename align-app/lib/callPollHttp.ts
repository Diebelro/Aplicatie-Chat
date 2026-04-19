import { NextResponse } from "next/server";

/** Răspuns JSON pentru poll-uri call — fără cache la intermediari. */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

export function callPollJsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}
