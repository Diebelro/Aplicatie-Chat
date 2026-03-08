"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";

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

  const load = () => {
    setLoading(true);
    fetch("/api/admin/reports", { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setReports(
          (data.reports ?? []).map((r: Report & { createdAt: Date }) => ({
            ...r,
            createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
          }))
        );
      })
      .catch(() => setError("Nu s-au putut incarca rapoartele."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Rapoarte</h1>
      {error && <p className="text-red-400 mb-2">{error}</p>}
      {loading ? (
        <p className="text-dark-400">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-dark-600 rounded">
            <thead>
              <tr className="bg-dark-700 text-left">
                <th className="p-2 border-b border-dark-600">Raportat (email)</th>
                <th className="p-2 border-b border-dark-600">Raportat (id)</th>
                <th className="p-2 border-b border-dark-600">Raportor (email)</th>
                <th className="p-2 border-b border-dark-600">Motiv</th>
                <th className="p-2 border-b border-dark-600">Data</th>
                <th className="p-2 border-b border-dark-600">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-dark-600">
                  <td className="p-2">{r.reportedEmail ?? "-"}</td>
                  <td className="p-2 font-mono text-sm">{r.reportedId.slice(0, 10)}...</td>
                  <td className="p-2">{r.reporterEmail ?? "-"}</td>
                  <td className="p-2 max-w-xs truncate">{r.reason}</td>
                  <td className="p-2 text-dark-400 text-sm">{r.createdAt}</td>
                  <td className="p-2">
                    <Link href={`/admin/users/${r.reportedId}`} className="text-brand-400 hover:underline mr-2">
                      User raportat
                    </Link>
                    <Link href={`/admin/conversations/${r.reporterId}_${r.reportedId}`} className="text-brand-400 hover:underline">
                      Conversatie
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
