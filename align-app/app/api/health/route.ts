import { NextResponse } from "next/server";

function resolveEnvironment(): "production" | "preview" | "development" {
  const v = process.env.VERCEL_ENV;
  if (v === "production" || v === "preview" || v === "development") return v;
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

function resolveNodeRuntime(): string {
  const v = process.version;
  if (v.startsWith("v")) return v.slice(1);
  return v;
}

/**
 * Health public pentru smoke-test / verificare deploy. Fără DB, fără secrete, fără git la runtime.
 * Metadata commit injectată la build (next.config.js → NEXT_PUBLIC_BUILD_COMMIT_*).
 */
export async function GET() {
  const full = (process.env.NEXT_PUBLIC_BUILD_COMMIT_FULL || "unknown").toLowerCase();
  const short = (process.env.NEXT_PUBLIC_BUILD_COMMIT_SHORT || "unknown").toLowerCase();
  const build = short;
  const environment = resolveEnvironment();
  const region = process.env.VERCEL_REGION?.trim();

  const body: Record<string, unknown> = {
    status: "ok",
    commit: {
      full,
      short,
    },
    build,
    environment,
    timestamp: new Date().toISOString(),
    runtime: {
      node: resolveNodeRuntime(),
    },
  };

  if (region) {
    body.vercelRegion = region;
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
