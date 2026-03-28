import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaGetUserRole,
  prismaAdminFetchMessagesForModerationScan,
} from "@/lib/repo-prisma";
import {
  scanMessageForCategories,
  MODERATION_CATEGORY_LABELS,
  type ModerationCategoryId,
} from "@/lib/moderationScan";

const VALID: ModerationCategoryId[] = [
  "threats",
  "sexual",
  "insults",
  "minors",
  "scams",
  "illegal_trade",
  "bot_automation",
];

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  if (!isPrismaAvailable()) return NextResponse.json({ error: "Neautorizat." }, { status: 403 });
  const role = await prismaGetUserRole(userId);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Acces interzis." }, { status: 403 });
  }

  const mode = request.nextUrl.searchParams.get("mode") || "text";
  const limit = Math.min(500, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "200", 10) || 200));
  const catsParam = request.nextUrl.searchParams.get("categories");
  const categories: ModerationCategoryId[] | null = catsParam
    ? (catsParam
        .split(",")
        .map((c) => c.trim())
        .filter((c): c is ModerationCategoryId => VALID.includes(c as ModerationCategoryId)) as ModerationCategoryId[])
    : null;

  try {
    if (mode === "attachments") {
      const rows = await prismaAdminFetchMessagesForModerationScan(limit, { onlyWithAttachment: true });
      return NextResponse.json({
        mode,
        labels: MODERATION_CATEGORY_LABELS,
        results: rows.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          matchedCategories: [] as ModerationCategoryId[],
          hasAttachment: true,
        })),
      });
    }

    if (mode !== "text") {
      return NextResponse.json({ error: "mode trebuie text sau attachments." }, { status: 400 });
    }

    const batch = Math.min(4000, Math.max(limit * 4, limit));
    const rows = await prismaAdminFetchMessagesForModerationScan(batch, { onlyNonEmptyText: true });
    const results: Array<{
      id: string;
      fromUserId: string;
      toUserId: string;
      text: string;
      attachmentUrl: string | null;
      attachmentContentType: string | null;
      createdAt: string;
      fromEmail: string;
      toEmail: string;
      matchedCategories: ModerationCategoryId[];
      hasAttachment: boolean;
    }> = [];

    for (const m of rows) {
      const matched = scanMessageForCategories(m.text, categories?.length ? categories : null);
      if (matched.length === 0) continue;
      results.push({
        ...m,
        createdAt: m.createdAt.toISOString(),
        matchedCategories: matched,
        hasAttachment: !!m.attachmentUrl,
      });
      if (results.length >= limit) break;
    }

    return NextResponse.json({ mode: "text", labels: MODERATION_CATEGORY_LABELS, results });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
