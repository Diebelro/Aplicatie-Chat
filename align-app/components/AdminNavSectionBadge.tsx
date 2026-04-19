"use client";

import { useAdminModerationSummary } from "@/components/AdminModerationSummaryProvider";

export type AdminNavSectionBadgeKey = "reports" | "appFeedback" | "appeals";

/**
 * Badge numeric lângă un link din nav-ul admin — doar pentru secțiunea indicată, același `since` ca summary-ul global.
 */
export function AdminNavSectionBadge({ section }: { section: AdminNavSectionBadgeKey }) {
  const { data } = useAdminModerationSummary();
  if (!data) return null;
  const n =
    section === "reports"
      ? data.newReportsSince
      : section === "appFeedback"
        ? data.newAppFeedbackSince
        : data.pendingBanAppeals;
  if (n <= 0) return null;
  return (
    <span
      className="inline-flex min-w-[1.15rem] justify-center rounded-full bg-red-600 px-1 py-px text-[10px] font-bold leading-tight text-zinc-900"
      aria-hidden
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
