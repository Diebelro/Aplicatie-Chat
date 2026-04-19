"use client";

import { useAdminModerationSummary } from "@/components/AdminModerationSummaryProvider";
import type { AdminModerationSummaryClient } from "@/components/AdminModerationSummaryProvider";

function buildAttentionTooltip(d: AdminModerationSummaryClient): string {
  const parts: string[] = [];
  if (d.newUsersSince > 0) {
    parts.push(
      `${d.newUsersSince} ${d.newUsersSince === 1 ? "înscriere nouă" : "înscrieri noi"}`
    );
  }
  if (d.newReportsSince > 0) {
    parts.push(`${d.newReportsSince} ${d.newReportsSince === 1 ? "raport" : "rapoarte"}`);
  }
  if (d.pendingBanAppeals > 0) {
    parts.push(
      `${d.pendingBanAppeals} ${d.pendingBanAppeals === 1 ? "contestare" : "contestări"}`
    );
  }
  if (d.newAppFeedbackSince > 0) {
    parts.push(
      `${d.newAppFeedbackSince} ${d.newAppFeedbackSince === 1 ? "feedback app" : "feedback-uri app"}`
    );
  }
  if (parts.length === 0) return "";
  return `De verificat: ${parts.join(", ")}`;
}

/**
 * Badge roșu lângă „Admin”: total față de checkpoint (useri + rapoarte + contestări + feedback app).
 */
export function AdminModerationNavBadge() {
  const { data } = useAdminModerationSummary();

  if (!data || data.attentionCount <= 0) return null;

  const title = buildAttentionTooltip(data);
  const n = data.attentionCount;

  return (
    <span
      className="ml-0.5 inline-flex min-w-[1.35rem] justify-center rounded-full bg-red-600 px-1.5 py-px text-[11px] font-bold text-zinc-900 leading-tight"
      title={title || undefined}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
