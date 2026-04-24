"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  ADMIN_CHECKPOINT_UPDATED_EVENT,
  readModerationSince,
  readSinceFor,
} from "@/lib/adminModerationCheckpoint";

/** Date necesare pentru badge-ul Admin + badge-uri pe secțiuni (același fetch). */
export type AdminModerationSummaryClient = {
  since: string;
  newUsersSince: number;
  newReportsSince: number;
  pendingBanAppeals: number;
  newAppFeedbackSince: number;
  attentionCount: number;
};

type Ctx = {
  data: AdminModerationSummaryClient | null;
  reload: () => void;
};

const AdminModerationSummaryContext = createContext<Ctx | null>(null);

function parseSummaryPayload(d: Record<string, unknown>): AdminModerationSummaryClient {
  const nu = typeof d.newUsersSince === "number" ? d.newUsersSince : 0;
  const nr = typeof d.newReportsSince === "number" ? d.newReportsSince : 0;
  const pb = typeof d.pendingBanAppeals === "number" ? d.pendingBanAppeals : 0;
  const nf = typeof d.newAppFeedbackSince === "number" ? d.newAppFeedbackSince : 0;
  const ac =
    typeof d.attentionCount === "number" ? d.attentionCount : nu + nr + pb + nf;
  return {
    since: typeof d.since === "string" ? d.since : new Date().toISOString(),
    newUsersSince: nu,
    newReportsSince: nr,
    pendingBanAppeals: pb,
    newAppFeedbackSince: nf,
    attentionCount: ac,
  };
}

export function AdminModerationSummaryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminModerationSummaryClient | null>(null);

  const reload = useCallback(() => {
    const q = new URLSearchParams({
      since: readModerationSince().toISOString(),
      sinceUsers: readSinceFor("users").toISOString(),
      sinceReports: readSinceFor("reports").toISOString(),
      sinceFeedback: readSinceFor("feedback").toISOString(),
    });
    void fetchWithAuthRetry("/api/admin/summary?" + q.toString())
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (!raw || typeof raw !== "object") {
          setData(null);
          return;
        }
        setData(parseSummaryPayload(raw as Record<string, unknown>));
      })
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    reload();
    if (typeof window === "undefined") return;
    window.addEventListener(ADMIN_CHECKPOINT_UPDATED_EVENT, reload);
    return () => window.removeEventListener(ADMIN_CHECKPOINT_UPDATED_EVENT, reload);
  }, [reload]);

  const value = useMemo(() => ({ data, reload }), [data, reload]);

  return (
    <AdminModerationSummaryContext.Provider value={value}>
      {children}
    </AdminModerationSummaryContext.Provider>
  );
}

export function useAdminModerationSummary(): Ctx {
  const v = useContext(AdminModerationSummaryContext);
  if (!v) {
    throw new Error("useAdminModerationSummary must be used inside AdminModerationSummaryProvider");
  }
  return v;
}
