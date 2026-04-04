import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Diagnostic local NextAuth + Prisma (fără secrete în răspuns).
 * Doar în development — în producție returnează 404.
 *
 * GET /api/auth/diag
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() || null;
  const secretLen = process.env.NEXTAUTH_SECRET?.trim().length ?? 0;
  const hasDbUrl = !!process.env.DATABASE_URL?.trim();

  let prismaPing: string;
  try {
    if (!hasDbUrl) {
      prismaPing = "skipped (no DATABASE_URL)";
    } else {
      await prisma.$queryRaw`SELECT 1`;
      prismaPing = "ok";
    }
  } catch (e) {
    prismaPing = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    nextAuthUrl,
    nextAuthSecretLength: secretLen,
    nextAuthSecretMin32: secretLen >= 32,
    databaseUrlConfigured: hasDbUrl,
    prismaPing,
    clientFetchHint:
      "CLIENT_FETCH_ERROR: verifică că rulezi `npm run dev` în align-app, deschizi același host ca NEXTAUTH_URL (localhost vs 127.0.0.1, port 3005), și că GET /api/auth/session nu e 500 (vezi terminal Next).",
  });
}
