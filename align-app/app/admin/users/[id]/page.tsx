"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";
import { Crown } from "lucide-react";

type User = { id: string; name?: string; email?: string; role?: string; isBanned?: boolean };
type PremiumInfo = { active: boolean; planId: string | null; premiumUntil: string | null };

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [premium, setPremium] = useState<PremiumInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumDays, setPremiumDays] = useState(30);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/users/" + id, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setUser(data.user);
        setPremium(data.premium ?? null);
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
        "Motiv ban (opțional, se salvează în loguri admin). Lasă gol dacă nu vrei motiv:",
        ""
      );
      if (r === null) return;
      reason = r.trim() || undefined;
    }
    setBusy(true);
    fetch("/api/admin/users/" + id + "/ban", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
    })
      .then((r) => (r.ok ? undefined : Promise.reject()))
      .then(() => load())
      .catch(() => setError("Eroare actiune."))
      .finally(() => setBusy(false));
  };

  const deleteUser = () => {
    if (!confirm("Stergi acest utilizator? Actiunea este ireversibila.")) return;
    setBusy(true);
    fetch("/api/admin/users/" + id, { method: "DELETE", headers: getAuthHeaders() })
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
    fetch("/api/admin/users/" + id + "/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ type, days: type === "trial" ? days : undefined }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then(() => load())
      .catch(() => setError("Eroare la acordarea Premium."))
      .finally(() => setBusy(false));
  };

  if (loading) return <p className="text-dark-400">Se incarca...</p>;
  if (error || !user) return <p className="text-red-400">{error ?? "Negasit"}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">User: {user.email ?? user.id}</h1>
      <div className="mb-4 space-y-1">
        <p><strong>Id:</strong> {user.id}</p>
        <p><strong>Email:</strong> {user.email ?? "-"}</p>
        <p><strong>Nume:</strong> {user.name ?? "-"}</p>
        <p><strong>Rol:</strong> {user.role ?? "USER"}</p>
        <p><strong>Blocat:</strong> {user.isBanned ? "Da" : "Nu"}</p>
        <p className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <strong>Premium:</strong> {premium?.active ? "Da" : "Nu"}
          {premium?.premiumUntil && premium.active && (
            <span className="text-dark-400 text-sm"> (pana la {new Date(premium.premiumUntil).toLocaleDateString("ro-RO")})</span>
          )}
          {premium?.planId && <span className="text-dark-500 text-sm"> — {premium.planId}</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {user.isBanned ? (
          <button onClick={() => ban("UNBAN")} disabled={busy} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-2 rounded">Unban</button>
        ) : (
          <button onClick={() => ban("BAN")} disabled={busy} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-2 rounded">Ban</button>
        )}
        <button onClick={deleteUser} disabled={busy} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-2 rounded">Sterge user</button>
        <Link
          href={"/admin/conversations?with=" + encodeURIComponent(id)}
          className="bg-dark-600 hover:bg-dark-500 px-3 py-2 rounded inline-block"
        >
          Conversație (alege al doilea user)
        </Link>
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
              className="w-20 bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-white text-sm"
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
