"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";
import { AlertTriangle } from "lucide-react";

type Report = {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  createdAt: string;
  reporterEmail?: string;
  reportedEmail?: string;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/reports", { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setReports(
          (data.reports ?? []).map((r: Report & { createdAt: Date }) => ({
            ...r,
            createdAt: r.createdAt
              ? new Date(r.createdAt).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })
              : "",
          }))
        );
      })
      .catch(() => setError("Nu s-au putut incarca rapoartele."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const banReported = (r: Report) => {
    const reasonDefault =
      ("Din raport: " + (r.reason || "").trim()).slice(0, 500) || "Moderare după raport";
    const reason = window.prompt("Motiv ban (se salvează în loguri admin):", reasonDefault);
    if (reason === null) return;
    setBanningId(r.id);
    setError(null);
    fetch("/api/admin/users/" + encodeURIComponent(r.reportedId) + "/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ action: "BAN", reason: reason.trim().slice(0, 4000) }),
    })
      .then((res) =>
        res.ok ? undefined : res.json().then((j) => Promise.reject(new Error(j.error || "Eroare ban")))
      )
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare la ban."))
      .finally(() => setBanningId(null));
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Rapoarte</h1>
      <p className="text-dark-400 text-sm mb-6">
        Motivul fiecărui raport este evidențiat mai jos; citește-l înainte de acțiuni pe user sau conversație.
      </p>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {loading ? (
        <p className="text-dark-400">Se incarca...</p>
      ) : reports.length === 0 ? (
        <p className="text-dark-500">Nu există rapoarte.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-dark-600 bg-dark-800/80 overflow-hidden"
            >
              <div className="flex items-start gap-3 border-b border-dark-600 bg-red-950/30 px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">Motiv raport</p>
                  <p className="mt-1 text-dark-50 text-base leading-relaxed whitespace-pre-wrap break-words font-medium">
                    {r.reason || "— (fără text)"}
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-dark-400">
                <span>
                  <span className="text-dark-500">Raportat:</span>{" "}
                  <span className="text-dark-200">{r.reportedEmail ?? r.reportedId}</span>
                </span>
                <span>
                  <span className="text-dark-500">Raportor:</span>{" "}
                  <span className="text-dark-200">{r.reporterEmail ?? r.reporterId}</span>
                </span>
                <span className="tabular-nums">{r.createdAt}</span>
              </div>
              <div className="px-4 pb-4 flex flex-wrap gap-3 items-center">
                <button
                  type="button"
                  disabled={banningId === r.id}
                  onClick={() => banReported(r)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-sm font-medium text-white"
                >
                  Banează utilizatorul raportat
                </button>
                <Link
                  href={`/admin/users/${r.reportedId}`}
                  className="text-brand-400 hover:underline text-sm font-medium"
                >
                  Profil utilizator raportat
                </Link>
                <Link
                  href={`/admin/conversations/${[r.reporterId, r.reportedId].sort().join("_")}`}
                  className="text-brand-400 hover:underline text-sm font-medium"
                >
                  Conversație raportor ↔ raportat
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
