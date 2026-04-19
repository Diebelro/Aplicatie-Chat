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
  Phone,
  MessageSquare,
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
  product: {
    shortStrip: string;
    webrtc: {
      envLayerCompleteForCalls: boolean;
      turnRequiredOk: boolean;
      turnRequiredError: string | null;
      signalingSecretsOk: boolean;
      signalingSecretsError: string | null;
      nextPublicTurnUrlCount: number;
      summaryOk: boolean;
    };
    signalingHealth: {
      checked: boolean;
      url: string | null;
      ok: boolean | null;
      httpStatus: number | null;
      latencyMs: number | null;
      error: string | null;
    };
    messages: {
      ok: boolean;
      skipped: boolean;
      error: string | null;
      lastMessageAt: string | null;
    };
  };
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
      ? "border-dark-600 bg-dark-800/50 border-l-2 border-l-emerald-600/50"
      : ok === false && !warn
        ? "border-dark-600 bg-dark-800/50 border-l-2 border-l-red-600/50"
        : warn
          ? "border-dark-600 bg-dark-800/50 border-l-2 border-l-amber-500/50"
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
        Indicatori din <strong className="text-dark-400">acest server</strong> (memorie, DB, erori, securitate,
        vitals). <strong className="text-dark-400">Apeluri &amp; mesaje</strong>: env WebRTC/TURN, semnalizare
        <code className="text-dark-500"> /health</code>, ultim mesaj în DB. Monitor extern:{" "}
        <code className="text-dark-500">GET /api/health</code>.
      </p>

      <p className="text-sm text-dark-400 border-l-2 border-dark-600 pl-3 py-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Activity className="w-4 h-4 shrink-0 text-dark-500 inline" aria-hidden />
        <span className="font-medium text-dark-300">Stare:</span>
        <span>
          {snap.overall === "ok" ? "în regulă" : snap.overall === "warn" ? "atenție" : "critică"}
        </span>
        {snap.overallReasons.length > 0 ? (
          <span className="text-dark-500">— {snap.overallReasons.join(" · ")}</span>
        ) : null}
        {pingMs != null && (
          <span className="text-zinc-500 text-xs">
            ({pingMs} ms · {new Date(snap.generatedAt).toLocaleString("ro-RO")})
          </span>
        )}
      </p>

      <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wide">
        Apeluri &amp; mesaje
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          title="WebRTC / TURN (env)"
          icon={Phone}
          ok={snap.product.webrtc.summaryOk}
          warn={!snap.product.webrtc.summaryOk}
        >
          <ul className="text-xs text-dark-300 space-y-1.5">
            <li>
              Strat complet pentru apeluri:{" "}
              <strong className="text-zinc-900">{snap.product.webrtc.envLayerCompleteForCalls ? "da" : "nu"}</strong>
            </li>
            <li>TURN valid: {snap.product.webrtc.turnRequiredOk ? "da" : "nu"}</li>
            {snap.product.webrtc.turnRequiredError && (
              <li className="text-red-300/90 break-words">{snap.product.webrtc.turnRequiredError}</li>
            )}
            <li>Secret semnalizare: {snap.product.webrtc.signalingSecretsOk ? "OK" : "lipsește"}</li>
            {snap.product.webrtc.signalingSecretsError && (
              <li className="text-amber-200/90 break-words">{snap.product.webrtc.signalingSecretsError}</li>
            )}
            <li>URL-uri TURN (număr): {snap.product.webrtc.nextPublicTurnUrlCount}</li>
          </ul>
        </Card>

        <Card
          title="Semnalizare (HTTP health)"
          icon={Server}
          ok={!snap.product.signalingHealth.checked ? undefined : snap.product.signalingHealth.ok === true}
          warn={snap.product.signalingHealth.checked && snap.product.signalingHealth.ok === false}
        >
          {!snap.product.signalingHealth.checked ? (
            <p className="text-dark-400 text-xs">
              Nu am URL de verificat (lipsește <code className="text-dark-500">NEXT_PUBLIC_SIGNALING_WS_URL</code> sau{" "}
              <code className="text-dark-500">SIGNALING_HEALTH_URL</code>).
            </p>
          ) : (
            <ul className="text-xs text-dark-300 space-y-1.5">
              <li className="break-all font-mono text-[11px] text-zinc-800">{snap.product.signalingHealth.url}</li>
              <li>
                Răspuns:{" "}
                <strong className="text-zinc-900">
                  {snap.product.signalingHealth.ok === true
                    ? "OK"
                    : snap.product.signalingHealth.ok === false
                      ? "eșuat"
                      : "—"}
                </strong>
                {snap.product.signalingHealth.httpStatus != null && (
                  <> · HTTP {snap.product.signalingHealth.httpStatus}</>
                )}
                {snap.product.signalingHealth.latencyMs != null && <> · {snap.product.signalingHealth.latencyMs} ms</>}
              </li>
              {snap.product.signalingHealth.error && (
                <li className="text-red-300/90 break-words">{snap.product.signalingHealth.error}</li>
              )}
            </ul>
          )}
        </Card>

        <Card
          title="Mesaje (DB)"
          icon={MessageSquare}
          ok={snap.product.messages.skipped ? undefined : snap.product.messages.ok}
          warn={!snap.product.messages.skipped && !snap.product.messages.ok}
        >
          {snap.product.messages.skipped ? (
            <p className="text-dark-400 text-xs">Sărit — baza de date nu e „up” în acest snapshot.</p>
          ) : (
            <ul className="text-xs text-dark-300 space-y-1.5">
              <li>
                Citire ultim mesaj:{" "}
                <strong className="text-zinc-900">{snap.product.messages.ok ? "OK" : "eșuat"}</strong>
              </li>
              {snap.product.messages.lastMessageAt && (
                <li>Ultim mesaj (createdAt): {new Date(snap.product.messages.lastMessageAt).toLocaleString("ro-RO")}</li>
              )}
              {!snap.product.messages.lastMessageAt && snap.product.messages.ok && (
                <li className="text-dark-500">Încă niciun mesaj în DB (normal la început).</li>
              )}
              {snap.product.messages.error && (
                <li className="text-red-300/90 break-words">{snap.product.messages.error}</li>
              )}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wide pt-2">Infrastructură proces</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Baza de date" icon={Database} ok={dbOk} warn={dbSkip && !dbOk}>
          <p className="text-lg font-medium text-zinc-900 capitalize">{snap.db.status}</p>
          {snap.db.latencyMs != null && <p className="text-dark-400 text-sm">Ping: {snap.db.latencyMs} ms</p>}
          {snap.db.detail && <p className="text-red-300/90 text-xs mt-1">{snap.db.detail}</p>}
        </Card>

        <Card title="Proces Node" icon={Server}>
          <p className="text-zinc-800 text-sm">Node {snap.nodeVersion}</p>
          <p className="text-zinc-800 text-sm">Mediu: {snap.environment}</p>
          <p className="text-zinc-800 text-sm mt-1 flex items-center gap-1">
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
          <p className="text-zinc-800 text-sm">
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
                <p className="text-zinc-800 mt-1 break-words">{e.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
