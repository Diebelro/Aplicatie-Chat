import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaGetUserRole,
  prismaGetReports,
  prismaDeleteReport,
  prismaCreateAdminLog,
} from "@/lib/repo-prisma";

async function requireAdmin(request: Request): Promise<
  { ok: true; userId: string } | { ok: false; res: NextResponse }
> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) return { ok: false, res: NextResponse.json({ error: "Neautorizat." }, { status: 401 }) };
  if (!isPrismaAvailable()) return { ok: false, res: NextResponse.json({ error: "Neautorizat." }, { status: 403 }) };
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return { ok: false, res: NextResponse.json({ error: "Acces interzis." }, { status: 403 }) };
  }
  return { ok: true, userId };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.res;
  try {
    const reports = await prismaGetReports();
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}

/** Închide / șterge un raport nefondat (ex. fără conversație, din răutate). */
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.res;
  try {
    const body = (await request.json().catch(() => ({}))) as { reportId?: string; note?: string };
    const reportId = typeof body.reportId === "string" ? body.reportId.trim() : "";
    if (!reportId) return NextResponse.json({ error: "Lipsește reportId." }, { status: 400 });
    const ok = await prismaDeleteReport(reportId);
    if (!ok) return NextResponse.json({ error: "Raportul nu a fost găsit." }, { status: 404 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    await prismaCreateAdminLog(
      auth.userId,
      "DISMISS_REPORT",
      reportId,
      note || "Raport închis (fără dovezi / fără conversație)."
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
