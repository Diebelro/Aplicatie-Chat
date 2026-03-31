"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  Activity,
  Database,
  HardDrive,
  Gauge,
  AlertTriangle,
  Shield,
  Clock,
  Server,
} from "lucide-react";

type ServerError = { at: string; source: string; message: string; stack?: string };

type FullSnap = {
  generatedAt: string;
  environment: string;
  nodeVersion: string;
  uptimeSec: number;
  memory: { heapUsedMb: number; rssMb: number; heapTotalMb: number };
  db: { status: string; latencyMs?: number; detail?: string };
  security: {
    highCount: number;
    mediumCount: number;
    lowCount: number;
    shouldAlert: boolean;
    windowMinutes: number;
  };
  errors: { count: number; recent: ServerError[]; windowMinutes: number };
  errors1h: { count: number };
  vitals: {
    latest: { path: string; lcpMs?: number; ttfbMs?: number; at: string } | null;
    avgLcpLast20: number | null;
  };
  rateLimitBucketsApprox: number;
  overall: "ok" | "warn" | "critical";
  overallReasons: string[];
};

function Card({
  title,
  icon: Icon,
  ok,
  warn,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  ok?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  const border =
    ok === true
      ? "border-emerald-800/60 bg-emerald-950/30"
      : ok === false && !warn
        ? "border-red-800/60 bg-red-950/25"
        : warn
          ? "border-amber-800/60 bg-amber-950/25"
          : "border-dark-600 bg-dark-800/60";
  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="flex items-center gap-2 text-dark-300 text-sm mb-2">
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </div>
      {children}
    </div>
  );
}

export default function AdminSystemDashboardPage() {
  const [snap, setSnap] = useState<FullSnap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const load = useCallback(() => {
    setErr(null);
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    fetchWithAuthRetry("/api/admin/system-status", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Eroare");
        return d as FullSnap;
      })
      .then((d) => {
        setSnap(d);
        if (typeof performance !== "undefined") setPingMs(Math.round(performance.now() - t0));
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  if (err) {
    return (
      <div className="p-6">
        <p className="text-red-400">{err}</p>
        <Link href="/admin" className="text-brand-400 hover:underline mt-4 inline-block">
          ← Dashboard
        </Link>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="p-6">
        <p className="text-dark-400">Se încarcă bordul…</p>
      </div>
    );
  }

  const dbOk = snap.db.status === "up";
  const dbSkip = snap.db.status === "skipped";
  const uptimeH = Math.floor(snap.uptimeSec / 3600);
  const uptimeM = Math.floor((snap.uptimeSec % 3600) / 60);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-brand-400 hover:underline text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Gauge className="w-6 h-6 text-brand-400" />
          Bord operațional
        </h1>
        <button
          type="button"
          onClick={() => load()}
          className="ml-auto text-sm px-3 py-1 rounded-lg bg-dark-700 hover:bg-dark-600"
        >
          Reîncarcă
        </button>
      </div>

      <p className="text-dark-500 text-sm">
        Indicatori din <strong className="text-dark-400">acest server</strong> (memorie, DB, erori neprinse, semnale
        securitate, viteze raportate din browser). Pentru „a picat tot” din exterior, folosește și un monitor care
        lovește <code className="text-dark-400">GET /api/health</code>.
      </p>

      <div
        className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${
          snap.overall === "critical"
            ? "border-red-600 bg-red-950/40 text-red-100"
            : snap.overall === "warn"
              ? "border-amber-600 bg-amber-950/35 text-amber-50"
              : "border-emerald-700 bg-emerald-950/30 text-emerald-50"
        }`}
      >
        <Activity className="w-8 h-8 shrink-0" />
        <div>
          <p className="font-semibold">
            Stare generală:{" "}
            {snap.overall === "ok" ? "în regulă" : snap.overall === "warn" ? "atenție" : "critică"}
          </p>
          {snap.overallReasons.length > 0 ? (
            <p className="text-sm opacity-90 mt-1">{snap.overallReasons.join(" · ")}</p>
          ) : (
            <p className="text-sm opacity-80 mt-1">Nu sunt motive de alertă din parametrii actuali.</p>
          )}
        </div>
        {pingMs != null && (
          <span className="text-xs ml-auto opacity-80">
            Latenta cerere: {pingMs} ms · {new Date(snap.generatedAt).toLocaleString("ro-RO")}
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Baza de date" icon={Database} ok={dbOk} warn={dbSkip && !dbOk}>
          <p className="text-lg font-medium text-zinc-900 capitalize">{snap.db.status}</p>
          {snap.db.latencyMs != null && <p className="text-dark-400 text-sm">Ping: {snap.db.latencyMs} ms</p>}
          {snap.db.detail && <p className="text-red-300/90 text-xs mt-1">{snap.db.detail}</p>}
        </Card>

        <Card title="Proces Node" icon={Server}>
          <p className="text-dark-200 text-sm">Node {snap.nodeVersion}</p>
          <p className="text-dark-200 text-sm">Mediu: {snap.environment}</p>
          <p className="text-dark-200 text-sm mt-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Uptime: {uptimeH}h {uptimeM}m
          </p>
        </Card>

        <Card title="Memorie" icon={HardDrive}>
          <p className="text-zinc-900 font-medium">
            Heap {snap.memory.heapUsedMb} / {snap.memory.heapTotalMb} MB
          </p>
          <p className="text-dark-400 text-sm">RSS ~{snap.memory.rssMb} MB</p>
        </Card>

        <Card
          title="Securitate (15 min)"
          icon={Shield}
          warn={snap.security.shouldAlert}
          ok={!snap.security.shouldAlert}
        >
          <p className="text-sm">
            Ridicat: <strong className="text-red-300">{snap.security.highCount}</strong> · Mediu:{" "}
            <strong className="text-amber-300">{snap.security.mediumCount}</strong>
          </p>
          <Link href="/admin/security" className="text-brand-400 text-xs hover:underline mt-2 inline-block">
            Detalii securitate →
          </Link>
        </Card>

        <Card
          title={`Erori server (${snap.errors.windowMinutes} min)`}
          icon={AlertTriangle}
          ok={snap.errors.count === 0}
          warn={snap.errors.count > 0 && snap.errors.count < 8}
        >
          <p className="text-2xl font-semibold text-zinc-900">{snap.errors.count}</p>
          <p className="text-dark-500 text-xs">Ultima oră: {snap.errors1h.count}</p>
        </Card>

        <Card title="Performanță (browser)" icon={Gauge}>
          <p className="text-dark-200 text-sm">
            LCP mediu (ultimele rapoarte):{" "}
            <strong className="text-zinc-900">{snap.vitals.avgLcpLast20 ?? "—"}</strong> ms
          </p>
          {snap.vitals.latest && (
            <p className="text-dark-500 text-xs mt-2 truncate" title={snap.vitals.latest.path}>
              Ultim: {snap.vitals.latest.path} · LCP {snap.vitals.latest.lcpMs ?? "—"} ms
            </p>
          )}
        </Card>
      </div>

      <div className="rounded-xl border border-dark-600 bg-dark-800/40 p-4">
        <p className="text-dark-400 text-sm mb-2">Rate limit (chei aprox. în memorie): {snap.rateLimitBucketsApprox}</p>
        <p className="text-dark-500 text-xs">
          <strong className="text-dark-400">Uptime extern:</strong> configurează un serviciu care apelează la interval{" "}
          <code className="text-dark-400">/api/health</code> — răspuns HTTP 503 = problemă DB configurată.
        </p>
      </div>

      {snap.errors.recent.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wide mb-2">
            Ultimele erori în proces
          </h2>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {snap.errors.recent.map((e, i) => (
              <li key={`${e.at}-${i}`} className="text-xs p-3 rounded-lg bg-dark-800 border border-dark-600">
                <span className="text-dark-500">{new Date(e.at).toLocaleString("ro-RO")}</span>{" "}
                <span className="text-amber-400/90 font-mono">{e.source}</span>
                <p className="text-dark-200 mt-1 break-words">{e.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
