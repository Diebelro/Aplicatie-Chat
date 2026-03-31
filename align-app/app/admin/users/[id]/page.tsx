"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { AlertTriangle, Clock, Crown } from "lucide-react";

type User = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  isBanned?: boolean;
  banUntil?: string | null;
};
type PremiumInfo = { active: boolean; planId: string | null; premiumUntil: string | null };
type BanLogInfo = { reason: string | null; at: string; adminEmail: string | null } | null;
type ReportAboutRow = {
  id: string;
  reporterId: string;
  reason: string;
  createdAt: string;
  reporterEmail: string | null;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [premium, setPremium] = useState<PremiumInfo | null>(null);
  const [banLog, setBanLog] = useState<BanLogInfo>(null);
  const [reportsAboutUser, setReportsAboutUser] = useState<ReportAboutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumDays, setPremiumDays] = useState(30);

  const load = () => {
    setLoading(true);
    fetchWithAuthRetry("/api/admin/users/" + id)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setUser(data.user);
        setPremium(data.premium ?? null);
        setBanLog(data.banLog ?? null);
        setReportsAboutUser(data.reportsAboutUser ?? []);
        setError(null);
      })
      .catch(() => setError("Utilizator negasit."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const ban = (action: "BAN" | "UNBAN") => {
    let reason: string | undefined;
    if (action === "BAN") {
      const r = window.prompt(
        "Motiv ban permanent (opțional, se salvează în loguri admin). Lasă gol dacă nu vrei motiv:",
        ""
      );
      if (r === null) return;
      reason = r.trim() || undefined;
    }
    setBusy(true);
    fetchWithAuthRetry("/api/admin/users/" + id + "/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
    })
      .then((r) => (r.ok ? undefined : Promise.reject()))
      .then(() => load())
      .catch(() => setError("Eroare actiune."))
      .finally(() => setBusy(false));
  };

  const suspend = (hours: number) => {
    if (
      !confirm(
        `Avertisment admin: îi oprești accesul la cont ${hours}h?\n\nBlocările între useri nu se șterg. La expirare, contul revine singur dacă nu e ban permanent.`
      )
    )
      return;
    const reason = window.prompt("Motiv scurt (opțional):", "") ?? "";
    setBusy(true);
    fetchWithAuthRetry("/api/admin/users/" + id + "/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUSPEND", hours, reason: reason.trim() }),
    })
      .then((r) => (r.ok ? undefined : Promise.reject()))
      .then(() => load())
      .catch(() => setError("Eroare suspendare."))
      .finally(() => setBusy(false));
  };

  const deleteUser = () => {
    if (!confirm("Stergi acest utilizator? Actiunea este ireversibila.")) return;
    setBusy(true);
    fetchWithAuthRetry("/api/admin/users/" + id, { method: "DELETE" })
      .then((r) => (r.ok ? undefined : Promise.reject()))
      .then(() => router.push("/admin/users"))
      .catch(() => { setError("Eroare stergere."); setBusy(false); });
  };

  const grantPremium = (type: "lifetime" | "trial") => {
    const days = type === "trial" ? premiumDays : undefined;
    if (type === "trial") {
      if (!days || days < 1 || days > 3650) {
        setError("Introdu un numar de zile intre 1 si 3650.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    fetchWithAuthRetry("/api/admin/users/" + id + "/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, days: type === "trial" ? days : undefined }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then(() => load())
      .catch(() => setError("Eroare la acordarea Premium."))
      .finally(() => setBusy(false));
  };

  if (loading) return <p className="text-dark-400">Se incarca...</p>;
  if (error || !user) return <p className="text-red-400">{error ?? "Negasit"}</p>;

  const banUntilActive =
    user.banUntil && new Date(user.banUntil) > new Date() ? new Date(user.banUntil) : null;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-3">User: {user.email ?? user.id}</h1>

      <div className="sticky top-0 z-10 -mx-2 px-2 py-3 mb-6 bg-dark-900/95 backdrop-blur border border-dark-600 rounded-xl">
        <p className="text-xs text-dark-500 uppercase tracking-wide mb-2">Acțiuni rapide</p>
        <p className="text-[11px] text-dark-400 leading-snug mb-3 border-l-2 border-brand-600/60 pl-2">
          Suspendarea pe ore e un <strong className="text-dark-200">avertisment la nivel de cont</strong> (nu poate folosi
          app-ul). Blocările făcute de alți utilizatori între ei <strong className="text-brand-300">nu dispar</strong> —
          sunt altceva în sistem.
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 6, 24, 72].map((h) => (
            <button
              key={h}
              type="button"
              disabled={busy}
              onClick={() => suspend(h)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-sm font-semibold"
            >
              <Clock className="w-4 h-4" />
              Suspendă {h}h
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {user.isBanned || banUntilActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => ban("UNBAN")}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-45 text-sm font-medium"
            >
              Deblochează complet
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => ban("BAN")}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-sm font-medium"
            >
              Ban permanent
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={deleteUser}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-45 text-sm font-medium"
          >
            Șterge user
          </button>
          <Link
            href={"/admin/conversations?with=" + encodeURIComponent(id)}
            className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm inline-flex items-center"
          >
            Conversație
          </Link>
        </div>
      </div>

      {user.isBanned && (
        <div
          className="mb-6 rounded-xl border-2 border-red-500/70 bg-red-950/35 px-4 py-4"
          role="status"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-red-200 font-semibold text-lg">
                Cont blocat
                {banUntilActive ? (
                  <span className="block text-sky-300 text-sm font-normal mt-1">
                    Suspendare activă până la{" "}
                    {banUntilActive.toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                ) : null}
              </p>
              {banLog?.reason ? (
                <p className="mt-2 text-dark-50 text-base leading-relaxed whitespace-pre-wrap break-words">
                  {banLog.reason}
                </p>
              ) : (
                <p className="mt-2 text-dark-400 text-sm">
                  Nu e salvat motiv în ultimul BAN (poate ban vechi fără notă). Verifică și{" "}
                  <Link href="/admin/logs" className="text-brand-400 hover:underline">
                    loguri admin
                  </Link>
                  .
                </p>
              )}
              {banLog && (
                <p className="mt-2 text-dark-500 text-xs tabular-nums">
                  {new Date(banLog.at).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })}
                  {banLog.adminEmail ? ` · acțiune de ${banLog.adminEmail}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {reportsAboutUser.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/50 bg-amber-950/25 px-4 py-4">
          <h2 className="text-lg font-semibold text-amber-100 mb-1 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden />
            Rapoarte despre acest utilizator ({reportsAboutUser.length})
          </h2>
          <p className="text-dark-500 text-xs mb-4">Motivul raportului este primul lucru vizibil la fiecare intrare.</p>
          <ul className="space-y-3">
            {reportsAboutUser.map((rep) => (
              <li
                key={rep.id}
                className="rounded-lg border border-dark-600 bg-dark-800/90 p-3"
              >
                <p className="text-dark-100 text-base leading-relaxed whitespace-pre-wrap break-words border-l-4 border-amber-500 pl-3 py-1 font-medium">
                  {rep.reason || "—"}
                </p>
                <p className="mt-2 text-dark-500 text-xs">
                  {new Date(rep.createdAt).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })} ·
                  raportor: {rep.reporterEmail ?? rep.reporterId}
                </p>
                <Link
                  href={`/admin/conversations/${[rep.reporterId, id].sort().join("_")}`}
                  className="text-brand-400 hover:underline text-sm mt-2 inline-block"
                >
                  Conversație cu raportorul
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 space-y-1">
        <p><strong>Id:</strong> {user.id}</p>
        <p><strong>Email:</strong> {user.email ?? "-"}</p>
        <p><strong>Nume:</strong> {user.name ?? "-"}</p>
        <p><strong>Rol:</strong> {user.role ?? "USER"}</p>
        <p>
          <strong>Blocat:</strong> {user.isBanned || banUntilActive ? "Da" : "Nu"}
          {user.banUntil && (
            <span className="text-dark-500 text-sm block mt-1">
              banUntil DB: {new Date(user.banUntil).toLocaleString("ro-RO")}
            </span>
          )}
        </p>
        <p className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <strong>Premium:</strong> {premium?.active ? "Da" : "Nu"}
          {premium?.premiumUntil && premium.active && (
            <span className="text-dark-400 text-sm"> (pana la {new Date(premium.premiumUntil).toLocaleDateString("ro-RO")})</span>
          )}
          {premium?.planId && <span className="text-dark-500 text-sm"> — {premium.planId}</span>}
        </p>
      </div>
      <div className="mt-6 p-4 rounded-xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          Acorda Premium gratuit / reducere
        </h2>
        <p className="text-dark-400 text-sm mb-4">
          Poti oferi utilizatorului acces gratuit la aplicatie: pe termen nelimitat sau pentru un numar de zile (ex. promotii, reduceri).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => grantPremium("lifetime")}
            disabled={busy}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 rounded font-medium"
          >
            Premium gratuit nelimitat
          </button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-dark-400">Premium gratuit pentru</label>
            <input
              type="number"
              min={1}
              max={3650}
              value={premiumDays}
              onChange={(e) => setPremiumDays(Math.min(3650, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-zinc-900 text-sm"
            />
            <span className="text-sm text-dark-400">zile</span>
            <button
              type="button"
              onClick={() => grantPremium("trial")}
              disabled={busy}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 px-4 py-2 rounded font-medium"
            >
              Aplică
            </button>
          </div>
        </div>
      </div>

      <p className="text-dark-400 text-sm mt-4">Pentru conversatie intre doi useri: /admin/conversations/userAId_userBId</p>
    </div>
  );
}
