"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { Globe2, RefreshCw } from "lucide-react";

type GeoUser = {
  id: string;
  email: string;
  username: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  countryRaw: string | null;
  profileCountry: string;
  city: string | null;
  completed: boolean;
  isBanned: boolean;
  ip: string | null;
  ipMarket: string;
  ipMarketLabel: string;
};

type GeoStats = {
  days: number;
  since: string;
  note: string;
  totals: {
    signupsInWindow: number;
    totalUsers: number;
    emptyCountryAll: number;
    byIpMarket: { de: number; ro: number; other: number; unknown: number };
    byProfileCountry: { country: string; count: number }[];
  };
  users: GeoUser[];
};

export default function AdminGeoPage() {
  const [days, setDays] = useState(30);
  const [market, setMarket] = useState("");
  const [data, setData] = useState<GeoStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ days: String(days) });
    if (market) q.set("market", market);
    fetchWithAuthRetry("/api/admin/geo-stats?" + q)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Eroare");
        return j as GeoStats;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message || "Nu s-a putut încărca."))
      .finally(() => setLoading(false));
  }, [days, market]);

  useEffect(() => {
    load();
  }, [load]);

  const ip = data?.totals.byIpMarket;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-brand-500" aria-hidden />
            Țări / piețe
          </h1>
          <p className="text-dark-400 text-sm mt-1 max-w-2xl">
            Vezi de unde vin userii: <strong className="text-zinc-800">țara din profil</strong> (ce au scris) și{" "}
            <strong className="text-zinc-800">estimare IP</strong> (RO vs DE pentru ads).
          </p>
        </div>
        <Link href="/admin" className="text-sm text-brand-500 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-5 p-3 rounded-xl border border-dark-600 bg-white/80">
        <div>
          <label className="block text-xs text-dark-500 mb-1">Perioadă signup</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>7 zile</option>
            <option value={14}>14 zile</option>
            <option value={30}>30 zile</option>
            <option value={90}>90 zile</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-dark-500 mb-1">Filtru listă</label>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Toți din perioadă</option>
            <option value="de">IP probabil DE</option>
            <option value="ro">IP probabil RO</option>
            <option value="other">Alt IP</option>
            <option value="profile-de">Profil = Germania</option>
            <option value="profile-ro">Profil = România</option>
            <option value="no-country">Fără țară pe profil</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-brand-500 text-white text-sm hover:bg-brand-400"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizează
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {data && (
        <>
          <p className="text-xs text-dark-500 mb-4">{data.note}</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label={`Signup-uri ${data.days}z`} value={data.totals.signupsInWindow} />
            <StatCard label="Total useri (tot)" value={data.totals.totalUsers} />
            <StatCard
              label="Fără țară (tot)"
              value={data.totals.emptyCountryAll}
              hint="Nu pot fi filtrați pe DE/RO în app"
            />
            <StatCard
              label="IP ≈ DE / RO"
              value={`${ip?.de ?? 0} / ${ip?.ro ?? 0}`}
              hint={`alt=${ip?.other ?? 0}, fără IP=${ip?.unknown ?? 0}`}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-dark-600 bg-white/80 p-4">
              <h2 className="font-semibold mb-2 text-sm">După țara din profil</h2>
              {data.totals.byProfileCountry.length === 0 ? (
                <p className="text-dark-500 text-sm">Nimic în perioadă.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.totals.byProfileCountry.map((c) => (
                    <li key={c.country} className="flex justify-between text-sm gap-3">
                      <span className="truncate">{c.country}</span>
                      <span className="tabular-nums font-medium shrink-0">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-dark-600 bg-white/80 p-4">
              <h2 className="font-semibold mb-2 text-sm">După IP (estimare ads)</h2>
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between">
                  <span>Probabil Germania</span>
                  <span className="tabular-nums font-medium text-emerald-700">{ip?.de ?? 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Probabil România</span>
                  <span className="tabular-nums font-medium text-sky-700">{ip?.ro ?? 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Alt / necunoscut</span>
                  <span className="tabular-nums font-medium">
                    {(ip?.other ?? 0) + (ip?.unknown ?? 0)}
                  </span>
                </li>
              </ul>
              <p className="text-xs text-dark-500 mt-3">
                Dacă plătești ads DE și aici e ~0, campania nu aduce signup-uri reale (sau vin fără IP DE
                clar).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-dark-600 overflow-hidden bg-white/80">
            <div className="px-3 py-2 border-b border-dark-600 flex justify-between items-center">
              <h2 className="font-semibold text-sm">Useri ({data.users.length})</h2>
              <span className="text-xs text-dark-500">
                de la{" "}
                {new Date(data.since).toLocaleDateString("ro-RO", { dateStyle: "medium" })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-700/50 text-left text-xs text-dark-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Profil țară</th>
                    <th className="px-3 py-2 font-medium">Oraș</th>
                    <th className="px-3 py-2 font-medium">IP / piață</th>
                    <th className="px-3 py-2 font-medium">Signup</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-t border-dark-600/70 hover:bg-dark-700/30">
                      <td className="px-3 py-2">
                        <Link href={"/admin/users/" + u.id} className="text-brand-600 hover:underline">
                          {u.username || u.email}
                        </Link>
                        <div className="text-[11px] text-dark-500 truncate max-w-[180px]">{u.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            u.profileCountry === "(fără țară)"
                              ? "text-amber-700"
                              : u.profileCountry === "Germania"
                                ? "text-emerald-700 font-medium"
                                : ""
                          }
                        >
                          {u.profileCountry}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-dark-500">{u.city || "—"}</td>
                      <td className="px-3 py-2">
                        <div
                          className={
                            u.ipMarket === "de"
                              ? "text-emerald-700 font-medium"
                              : u.ipMarket === "ro"
                                ? "text-sky-700"
                                : "text-dark-500"
                          }
                        >
                          {u.ipMarketLabel}
                        </div>
                        <div className="text-[11px] text-dark-500 font-mono">{u.ip || "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-dark-500 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleString("ro-RO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))}
                  {data.users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-dark-500">
                        Niciun user pe filtrul ales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && !data && <p className="text-dark-500 text-sm">Se încarcă…</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dark-600 bg-white/80 px-3 py-3">
      <p className="text-xs text-dark-500">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
      {hint ? <p className="text-[11px] text-dark-500 mt-0.5">{hint}</p> : null}
    </div>
  );
}
