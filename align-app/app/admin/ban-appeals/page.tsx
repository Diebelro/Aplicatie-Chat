"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { Scale } from "lucide-react";
import { SkeletonAdminStack } from "@/components/perceived/AppShellLoadingLayout";

type Appeal = {
  id: string;
  userId: string;
  userEmail: string;
  message: string;
  createdAt: string;
};

export default function AdminBanAppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchWithAuthRetry("/api/admin/ban-appeals")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((d) => {
        setAppeals(
          (d.appeals ?? []).map((a: Appeal & { createdAt: string }) => ({
            ...a,
            createdAt: a.createdAt
              ? new Date(a.createdAt).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })
              : "",
          }))
        );
      })
      .catch(() => setError("Nu s-au putut încărca contestările."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = (id: string, action: "UNBAN" | "DISMISS") => {
    const msg =
      action === "UNBAN"
        ? "Deblochezi contul și închizi cererea ca acceptată?"
        : "Respingi cererea? Contul rămâne blocat.";
    if (!confirm(msg)) return;
    setBusyId(id);
    fetchWithAuthRetry("/api/admin/ban-appeals/" + encodeURIComponent(id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || "Eroare")))))
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="w-7 h-7 text-red-300" aria-hidden />
        <h1 className="text-2xl font-semibold">Contestații blocare</h1>
      </div>
      <p className="text-dark-400 text-sm mb-6">
        Utilizatorii blocați pot cere revizuirea. Citește mesajul — dacă blocarea a fost greșită, apasă{" "}
        <strong className="text-zinc-800">Deblochează</strong>. Dacă menții decizia, <strong className="text-zinc-800">Respinge cererea</strong>.
      </p>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {loading ? (
        <SkeletonAdminStack cards={3} />
      ) : appeals.length === 0 ? (
        <p className="text-zinc-500">Nu există contestări în așteptare.</p>
      ) : (
        <ul className="space-y-4">
          {appeals.map((a) => (
            <li key={a.id} className="rounded-xl border border-dark-600 bg-dark-800/90 overflow-hidden">
              <div className="border-b border-dark-600 px-4 py-3 flex flex-wrap gap-3 text-sm text-dark-400">
                <span>
                  <span className="text-zinc-500">Utilizator:</span>{" "}
                  <Link href={"/admin/users/" + a.userId} className="text-brand-400 hover:underline">
                    {a.userEmail}
                  </Link>
                </span>
                <span className="tabular-nums">{a.createdAt}</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-red-300/90 mb-1">Mesaj</p>
                <p className="text-zinc-900 text-base leading-relaxed whitespace-pre-wrap break-words">{a.message}</p>
              </div>
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => act(a.id, "UNBAN")}
                  className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  Deblochează contul
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => act(a.id, "DISMISS")}
                  className="px-3 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 disabled:opacity-50 text-sm"
                >
                  Respinge cererea
                </button>
                <Link
                  href={"/admin/users/" + a.userId}
                  className="px-3 py-2 rounded-lg border border-dark-600 text-brand-400 hover:bg-dark-700 text-sm inline-flex items-center"
                >
                  Profil / Ban
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
