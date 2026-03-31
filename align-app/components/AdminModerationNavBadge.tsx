"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  ADMIN_CHECKPOINT_UPDATED_EVENT,
  readModerationSince,
} from "@/lib/adminModerationCheckpoint";

/**
 * Badge roșu lângă „Admin” când există useri/rapoarte noi față de checkpoint (sau ultimele 7 zile).
 */
export function AdminModerationNavBadge() {
  const [attention, setAttention] = useState<number | null>(null);

  const load = useCallback(() => {
    const since = readModerationSince();
    const q = new URLSearchParams({ since: since.toISOString() });
    fetchWithAuthRetry("/api/admin/summary?" + q.toString())
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setAttention(null);
          return;
        }
        const n =
          typeof d.attentionCount === "number"
            ? d.attentionCount
            : (d.newUsersSince ?? 0) + (d.newReportsSince ?? 0) + (d.pendingBanAppeals ?? 0);
        setAttention(n);
      })
      .catch(() => setAttention(null));
  }, []);

  useEffect(() => {
    load();
    if (typeof window === "undefined") return;
    window.addEventListener(ADMIN_CHECKPOINT_UPDATED_EVENT, load);
    return () => window.removeEventListener(ADMIN_CHECKPOINT_UPDATED_EVENT, load);
  }, [load]);

  if (attention === null || attention === 0) return null;

  return (
    <span
      className="ml-0.5 inline-flex min-w-[1.35rem] justify-center rounded-full bg-red-600 px-1.5 py-px text-[11px] font-bold text-zinc-900 leading-tight"
      title={`De verificat: ${attention} (înscrieri + rapoarte noi față de ultimul punct)`}
    >
      {attention > 99 ? "99+" : attention}
    </span>
  );
}
