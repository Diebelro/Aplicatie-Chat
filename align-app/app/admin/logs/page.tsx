"use client";

import { useEffect, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { SkeletonAdminTable } from "@/components/perceived/AppShellLoadingLayout";

type Log = {
  id: string;
  adminId: string;
  action: string;
  targetId: string | null;
  details?: string | null;
  createdAt: string;
  adminEmail?: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuthRetry("/api/admin/logs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setLogs(
          (data.logs ?? []).map((l: Log & { createdAt: Date }) => ({
            ...l,
            createdAt: l.createdAt ? new Date(l.createdAt).toLocaleString() : "",
          }))
        );
      })
      .catch(() => setError("Nu s-au putut încărca logurile."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Loguri acțiuni admin</h1>
      {error && <p className="text-red-400 mb-2">{error}</p>}
      {loading ? (
        <SkeletonAdminTable rows={8} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-dark-600 rounded">
            <thead>
              <tr className="bg-dark-700 text-left">
                <th className="p-2 border-b border-dark-600">Acțiune</th>
                <th className="p-2 border-b border-dark-600">Admin (email)</th>
                <th className="p-2 border-b border-dark-600">Target id</th>
                <th className="p-2 border-b border-dark-600">Data</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-dark-600">
                  <td className="p-2">{l.action}</td>
                  <td className="p-2">{l.adminEmail ?? l.adminId}</td>
                  <td className="p-2 font-mono text-sm">{l.targetId ? `${l.targetId.slice(0, 12)}…` : "—"}</td>
                  <td className="p-2 text-sm text-dark-300 max-w-xs break-words">{l.details?.trim() || "—"}</td>
                  <td className="p-2 text-dark-400 text-sm">{l.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
