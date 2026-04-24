import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaCountPendingBanAppeals,
  prismaGetAdminModerationSummary,
  prismaGetUserRole,
} from "@/lib/repo-prisma";

const MAX_SINCE_AGE_MS = 366 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) {
    return NextResponse.json(
      { error: "Dashboard admin necesită DATABASE_URL pe server." },
      { status: 503 }
    );
  }
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }

  const rawSince = request.nextUrl.searchParams.get("since");
  let sinceDefault = rawSince ? new Date(rawSince) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(sinceDefault.getTime())) {
    sinceDefault = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
  const oldest = new Date(Date.now() - MAX_SINCE_AGE_MS);
  if (sinceDefault < oldest) sinceDefault = oldest;

  function parseSinceParam(name: string, fallback: Date): Date {
    const raw = request.nextUrl.searchParams.get(name);
    if (!raw) return fallback;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return fallback;
    return d < oldest ? oldest : d;
  }

  const sinceByKind = {
    users: parseSinceParam("sinceUsers", sinceDefault),
    reports: parseSinceParam("sinceReports", sinceDefault),
    feedback: parseSinceParam("sinceFeedback", sinceDefault),
  };

  const [summary, pendingBanAppeals] = await Promise.all([
    prismaGetAdminModerationSummary(sinceByKind),
    prismaCountPendingBanAppeals(),
  ]);
  return NextResponse.json({
    since: sinceDefault.toISOString(),
    ...summary,
    pendingBanAppeals,
    attentionCount:
      summary.newUsersSince +
      summary.newReportsSince +
      pendingBanAppeals +
      summary.newAppFeedbackSince,
  });
}
