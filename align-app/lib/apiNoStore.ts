import { NextResponse } from "next/server";

/** API-uri dinamice (mesaje, feed, swipe) — fără cache la CDN/proxy. */
export const API_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export function apiJsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...API_NO_STORE_HEADERS, ...init?.headers },
  });
}
