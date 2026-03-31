"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { ShieldAlert } from "lucide-react";

type Ev = {
  at: string;
  severity: string;
  type: string;
  message: string;
  ip?: string;
  path?: string;
  userId?: string;
  meta?: string;
};

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [high, setHigh] = useState(0);
  const [medium, setMedium] = useState(0);
  const [low, setLow] = useState(0);
  const [shouldAlert, setShouldAlert] = useState(false);
  const [win, setWin] = useState(15);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setErr(null);
    fetchWithAuthRetry(`/api/admin/security-threats?windowMin=${win}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Eroare");
        return d as { events: Ev[]; highCount: number; mediumCount: number; lowCount: number; shouldAlert: boolean };
      })
      .then((d) => {
        setEvents(d.events ?? []);
        setHigh(d.highCount ?? 0);
        setMedium(d.mediumCount ?? 0);
        setLow(d.lowCount ?? 0);
        setShouldAlert(!!d.shouldAlert);
      })
      .catch((e: Error) => setErr(e.message));
  }, [win]);

  useEffect(() => {
    load();
  }, [load]);

  const sevClass = (s: string) =>
    s === "high"
      ? "text-red-300 bg-red-950/50 border-red-700"
      : s === "medium"
        ? "text-amber-200 bg-amber-950/40 border-amber-800/60"
        : "text-dark-300 bg-dark-800 border-dark-600";

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/admin" className="text-brand-400 hover:underline text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className={`w-6 h-6 ${shouldAlert ? "text-red-400" : "text-dark-400"}`} />
          Monitor securitate
        </h1>
      </div>

      <p className="text-dark-500 text-sm mb-4">
        Evenimente agregări automate: rate limit depășit, încercări de login suspecte, device-uri blocate, swipe-uri
        anormale. Datele sunt în <strong className="text-dark-400">memoria acestui server</strong> — pe serverless
        fiecare instanță vede doar traficul ei; la producție serioasă folosiți Redis / SIEM.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <label className="text-sm text-dark-400">
          Fereastră (min)
          <select
            value={win}
            onChange={(e) => setWin(Number(e.target.value))}
            className="ml-2 bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-zinc-900"
          >
            {[5, 15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => load()}
          className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm"
        >
          Reîncarcă
        </button>
        <div className="flex gap-3 text-sm">
          <span className="text-red-300">
            Ridicată: <strong>{high}</strong>
          </span>
          <span className="text-amber-300">
            Medie: <strong>{medium}</strong>
          </span>
          <span className="text-dark-500">
            Mică: <strong>{low}</strong>
          </span>
        </div>
      </div>

      {err && <p className="text-red-400 text-sm mb-4">{err}</p>}

      {events.length === 0 ? (
        <p className="text-dark-500">Nicio înregistrare în intervalul selectat.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e, i) => (
            <li
              key={`${e.at}-${e.type}-${i}`}
              className={`rounded-xl border px-3 py-2 text-sm ${sevClass(e.severity)}`}
            >
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                <time className="text-xs tabular-nums opacity-80" dateTime={e.at}>
                  {new Date(e.at).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "medium" })}
                </time>
                <span className="text-xs uppercase tracking-wide opacity-80">{e.severity}</span>
                <span className="font-mono text-xs opacity-90">{e.type}</span>
              </div>
              <p className="mt-1">{e.message}</p>
              <div className="mt-1 text-xs opacity-80 flex flex-wrap gap-x-3 gap-y-0">
                {e.ip && <span>IP: {e.ip}</span>}
                {e.path && <span>{e.path}</span>}
                {e.userId && (
                  <Link href={`/admin/users/${encodeURIComponent(e.userId)}`} className="underline hover:text-brand-400">
                    user
                  </Link>
                )}
                {e.meta && <span className="truncate max-w-full">{e.meta}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
