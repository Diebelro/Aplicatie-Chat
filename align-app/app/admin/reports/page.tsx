"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { markSectionReviewed } from "@/lib/adminModerationCheckpoint";
import { AlertTriangle, MessageSquare, MessageSquareOff, ChevronDown, ChevronUp } from "lucide-react";
import { SkeletonAdminStack } from "@/components/perceived/AppShellLoadingLayout";

type Report = {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  createdAt: string;
  reporterEmail?: string;
  reportedEmail?: string;
  messageCount: number;
};

type PreviewMsg = {
  id: string;
  fromId: string;
  text: string;
  at: string;
  isPlatformNotice?: boolean;
};

function conversationId(a: string, b: string): string {
  return [a, b].sort().join("_");
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const [previewByReport, setPreviewByReport] = useState<
    Record<string, { loading: boolean; error?: string; messages: PreviewMsg[]; labels: Record<string, string> }>
  >({});

  const load = () => {
    setLoading(true);
    fetchWithAuthRetry("/api/admin/reports")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setReports(
          (data.reports ?? []).map((r: Report & { createdAt: Date | string; messageCount?: number }) => ({
            ...r,
            messageCount: typeof r.messageCount === "number" ? r.messageCount : 0,
            createdAt: r.createdAt
              ? new Date(r.createdAt).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })
              : "",
          }))
        );
        markSectionReviewed("reports");
      })
      .catch(() => setError("Nu s-au putut incarca rapoartele."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const togglePreview = (r: Report) => {
    if (openPreviewId === r.id) {
      setOpenPreviewId(null);
      return;
    }
    setOpenPreviewId(r.id);
    if (previewByReport[r.id]?.messages?.length) return;

    setPreviewByReport((prev) => ({
      ...prev,
      [r.id]: { loading: true, messages: [], labels: {} },
    }));
    const cid = conversationId(r.reporterId, r.reportedId);
    fetchWithAuthRetry("/api/admin/conversations/" + encodeURIComponent(cid))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        const labels: Record<string, string> = {};
        if (data.userA?.id) labels[data.userA.id] = data.userA.email || data.userA.name || data.userA.id;
        if (data.userB?.id) labels[data.userB.id] = data.userB.email || data.userB.name || data.userB.id;
        const messages = ((data.messages ?? []) as PreviewMsg[]).slice(-40);
        setPreviewByReport((prev) => ({
          ...prev,
          [r.id]: { loading: false, messages, labels },
        }));
      })
      .catch(() => {
        setPreviewByReport((prev) => ({
          ...prev,
          [r.id]: { loading: false, error: "Nu s-a putut încărca conversația.", messages: [], labels: {} },
        }));
      });
  };

  const banUser = (userId: string, reportId: string, label: string, reasonDefault: string) => {
    const reason = window.prompt(`Motiv ban ${label}:`, reasonDefault);
    if (reason === null) return;
    setBanningId(reportId + ":" + userId);
    setError(null);
    fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId) + "/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "BAN", reason: reason.trim().slice(0, 4000) }),
    })
      .then((res) =>
        res.ok ? undefined : res.json().then((j) => Promise.reject(new Error(j.error || "Eroare ban")))
      )
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare la ban."))
      .finally(() => setBanningId(null));
  };

  const dismissReport = (r: Report) => {
    const noteDefault =
      r.messageCount === 0
        ? "Raport fără conversație — închis ca nefondat / posibil din răutate."
        : "Raport închis (fără acțiune).";
    if (!window.confirm("Închizi acest raport? Dispare din listă (nu banăm pe nimeni automat).")) return;
    setDismissingId(r.id);
    setError(null);
    fetchWithAuthRetry("/api/admin/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: r.id, note: noteDefault }),
    })
      .then((res) =>
        res.ok ? undefined : res.json().then((j) => Promise.reject(new Error(j.error || "Eroare")))
      )
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare la închiderea raportului."))
      .finally(() => setDismissingId(null));
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Rapoarte</h1>
      <p className="text-dark-400 text-sm mb-6">
        Dacă există chat, apeși <strong className="text-zinc-800">„Citește conversația”</strong> — mesajele apar aici, pe loc.
        Dacă e 0 mesaje, e raport doar din profil (fără dovezi în chat).
      </p>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {loading ? (
        <SkeletonAdminStack cards={4} />
      ) : reports.length === 0 ? (
        <p className="text-zinc-500">Nu există rapoarte.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const noChat = r.messageCount === 0;
            const previewOpen = openPreviewId === r.id;
            const preview = previewByReport[r.id];
            return (
              <li
                key={r.id}
                className="rounded-xl border border-dark-600 bg-dark-800/80 overflow-hidden"
              >
                <div className="flex items-start gap-3 border-b border-dark-600 bg-red-950/30 px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">Motiv raport</p>
                    <p className="mt-1 text-zinc-900 text-base leading-relaxed whitespace-pre-wrap break-words font-medium">
                      {r.reason || "— (fără text)"}
                    </p>
                  </div>
                </div>

                {noChat ? (
                  <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950">
                    <MessageSquareOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    <p>
                      <strong>Fără conversație</strong> (0 mesaje). Nu ai ce citi în chat — raport probabil doar din
                      profil.
                    </p>
                  </div>
                ) : (
                  <div className="border-b border-dark-600 px-4 py-2.5 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-dark-400">
                      {r.messageCount} mesaj{r.messageCount === 1 ? "" : "e"} în chat
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePreview(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-dark-900 text-sm font-semibold"
                    >
                      <MessageSquare className="w-4 h-4" aria-hidden />
                      {previewOpen ? "Ascunde conversația" : "Citește conversația"}
                      {previewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/admin/conversations/${conversationId(r.reporterId, r.reportedId)}`}
                      className="text-brand-400 hover:underline text-sm font-medium"
                    >
                      Deschide pe pagină întreagă
                    </Link>
                  </div>
                )}

                {previewOpen && !noChat ? (
                  <div className="border-b border-dark-600 bg-dark-900/50 px-4 py-3 max-h-80 overflow-y-auto overscroll-contain">
                    {preview?.loading ? (
                      <p className="text-dark-500 text-sm">Se încarcă mesajele…</p>
                    ) : preview?.error ? (
                      <p className="text-red-400 text-sm">{preview.error}</p>
                    ) : !preview?.messages.length ? (
                      <p className="text-dark-500 text-sm">Niciun mesaj vizibil.</p>
                    ) : (
                      <ul className="space-y-2">
                        {preview.messages.map((m) => (
                          <li key={m.id} className="text-sm">
                            <span className="text-xs text-dark-500 tabular-nums">
                              {m.at
                                ? new Date(m.at).toLocaleString("ro-RO", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : ""}
                            </span>{" "}
                            <span className="font-medium text-brand-300">
                              {preview.labels[m.fromId] || m.fromId.slice(0, 8)}
                              {m.isPlatformNotice ? " (sistem)" : ""}:
                            </span>{" "}
                            <span className="text-zinc-800 whitespace-pre-wrap break-words">
                              {m.text || "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                <div className="px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-dark-400">
                  <span>
                    <span className="text-zinc-500">Raportat:</span>{" "}
                    <span className="text-zinc-800">{r.reportedEmail ?? r.reportedId}</span>
                  </span>
                  <span>
                    <span className="text-zinc-500">Raportor:</span>{" "}
                    <span className="text-zinc-800">{r.reporterEmail ?? r.reporterId}</span>
                  </span>
                  <span className="tabular-nums">{r.createdAt}</span>
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-3 items-center">
                  <button
                    type="button"
                    disabled={dismissingId === r.id}
                    onClick={() => dismissReport(r)}
                    className="px-3 py-1.5 rounded-lg border border-dark-500 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-sm font-medium text-zinc-800"
                  >
                    {dismissingId === r.id ? "Se închide…" : "Închide raportul (nefondat)"}
                  </button>
                  <button
                    type="button"
                    disabled={banningId === r.id + ":" + r.reportedId}
                    onClick={() =>
                      banUser(
                        r.reportedId,
                        r.id,
                        "utilizator raportat",
                        ("Din raport: " + (r.reason || "").trim()).slice(0, 500) || "Moderare după raport"
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-sm font-medium text-white"
                  >
                    Banează raportatul
                  </button>
                  {noChat ? (
                    <button
                      type="button"
                      disabled={banningId === r.id + ":" + r.reporterId}
                      onClick={() =>
                        banUser(
                          r.reporterId,
                          r.id,
                          "raportor (abuz)",
                          "Raporturi false / abuz de raportare (fără conversație)."
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 text-sm font-medium text-white"
                    >
                      Banează raportorul (abuz)
                    </button>
                  ) : null}
                  <Link
                    href={`/admin/users/${r.reportedId}`}
                    className="text-brand-400 hover:underline text-sm font-medium"
                  >
                    Profil raportat
                  </Link>
                  <Link
                    href={`/admin/users/${r.reporterId}`}
                    className="text-brand-400 hover:underline text-sm font-medium"
                  >
                    Profil raportor
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
