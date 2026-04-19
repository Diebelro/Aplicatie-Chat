"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { Clock, ShieldAlert, Trash2, ExternalLink } from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  banUntil: string | null;
  createdAt: string;
};

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    fetchWithAuthRetry("/api/admin/users?" + q.toString())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        const list = data.users ?? [];
        setUsers(
          list.map((u: UserRow & { createdAt: Date; banUntil: Date | null }) => ({
            ...u,
            banUntil: u.banUntil ? new Date(u.banUntil).toISOString() : null,
            createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString("ro-RO") : "",
          }))
        );
      })
      .catch(() => setError("Eroare incarcare."))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const runBan = (userId: string, payload: Record<string, unknown>, actionKey: string) => {
    setBusyId(userId);
    setBusyAction(actionKey);
    setError(null);
    fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId) + "/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || "Eroare")))))
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => {
        setBusyId(null);
        setBusyAction(null);
      });
  };

  const suspend = (userId: string, hours: number) => {
    if (
      !confirm(
        `Avertisment admin: suspendare ${hours}h?\n\n` +
          `• Nu se ating relațiile „block” între utilizatori.\n` +
          `• Contul nu se poate loga în platformă până expiră (auto) sau îl deblochezi tu.`
      )
    )
      return;
    const reason = window.prompt("Motiv scurt (opțional):", "") ?? "";
    runBan(userId, { action: "SUSPEND", hours, reason: reason.trim() }, `s${hours}`);
  };

  const banPermanent = (userId: string) => {
    const reason = window.prompt("Motiv ban permanent (opțional):", "");
    if (reason === null) return;
    if (!confirm("Ban PERMANENT până la Unban manual?")) return;
    runBan(userId, { action: "BAN", reason: reason.trim() }, "ban");
  };

  const unban = (userId: string) => {
    if (!confirm("Scoți blocarea complet (inclusiv suspendare)?")) return;
    runBan(userId, { action: "UNBAN" }, "unban");
  };

  const deleteUser = (userId: string, email: string) => {
    if (!confirm(`Ștergi definitiv contul ${email}? Ireversibil.`)) return;
    setBusyId(userId);
    setBusyAction("del");
    setError(null);
    fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId), { method: "DELETE" })
      .then((r) => (r.ok ? undefined : Promise.reject(new Error("Eroare ștergere"))))
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => {
        setBusyId(null);
        setBusyAction(null);
      });
  };

  const isBusy = (id: string, key: string) => busyId === id && busyAction === key;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Utilizatori</h1>
      <p className="text-dark-400 text-sm mb-4">
        Fiecare card are butoane mari: <strong className="text-zinc-800">avertisment — suspendare pe ore</strong>{" "}
        (utilizatorul nu se poate loga până expiră; apoi revine singur), ban permanent, deblocare, ștergere.
      </p>
      <div className="rounded-lg border border-dark-600 bg-dark-800/80 px-3 py-2 text-dark-300 text-xs mb-4 leading-relaxed">
        <strong className="text-zinc-900">Blocare între utilizatori</strong> (când cineva apasă „block” pe altcineva){" "}
        <strong className="text-brand-300">rămâne</strong> — nu o ștergem și nu o schimbăm din acest panou. Suspendarea
        ta e la nivelul <strong className="text-zinc-900">întregului cont</strong>: îl „meditezi” câteva ore fără acces,
        relațiile lui de block/match rămân în baza de date.
      </div>
      <input
        type="text"
        placeholder="Caută email sau id"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 w-full max-w-md mb-4"
      />
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
      {loading ? (
        <p className="text-dark-400">Se încarcă…</p>
      ) : (
        <ul className="space-y-4">
          {users.map((u) => {
            const untilLabel = formatUntil(u.banUntil);
            const activeTemp = u.banUntil && new Date(u.banUntil) > new Date();
            return (
              <li
                key={u.id}
                className="rounded-xl border border-dark-600 bg-dark-800/90 p-4 shadow-lg shadow-black/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium text-zinc-900 text-lg">{u.email}</p>
                    <p className="text-dark-500 text-xs font-mono mt-0.5">{u.id}</p>
                    <p className="text-dark-500 text-xs mt-1">
                      Creat: {u.createdAt} · Rol: {u.role}
                    </p>
                    {(u.isBanned || activeTemp) && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-amber-200 text-sm">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        {activeTemp && untilLabel ? (
                          <>Suspendat până la {untilLabel}</>
                        ) : u.isBanned ? (
                          <>Blocat (permanent sau până la Unban)</>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <Link
                    href={"/admin/users/" + u.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-brand-400 text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Profil complet
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="w-full text-[11px] uppercase tracking-wide text-dark-500 mb-1">
                    Avertisment (suspendare cont, ore)
                  </span>
                  {[1, 6, 24, 72].map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => suspend(u.id, h)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-500 disabled:opacity-45 text-white text-sm font-semibold"
                    >
                      <Clock className="w-4 h-4" />
                      {h}h
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dark-600">
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => banPermanent(u.id)}
                    className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-sm font-medium text-white"
                  >
                    Ban permanent
                  </button>
                  <button
                    type="button"
                    disabled={busyId === u.id || (!u.isBanned && !activeTemp)}
                    onClick={() => unban(u.id)}
                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-35 text-sm font-medium"
                  >
                    {isBusy(u.id, "unban") ? "…" : "Deblochează"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => deleteUser(u.id, u.email)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-45 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Șterge cont
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
