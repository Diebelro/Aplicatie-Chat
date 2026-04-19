"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/authClient";

type Snap = {
  overall: "ok" | "warn" | "critical";
  overallReasons: string[];
  db: { status: string; latencyMs?: number; detail?: string };
  errors: { count: number; windowMinutes: number };
  memory: { heapUsedMb: number };
  vitals: { avgLcpLast20: number | null };
  generatedAt: string;
  /** Rezumat „Apeluri & mesaje” (același ca pe /admin/system) — poate fi OK la env dar apelul tot poate eșua (coturn, rețea, WS token). */
  product?: {
    shortStrip: string;
    webrtc: { summaryOk: boolean };
  };
};

export function AdminSystemStrip() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const t0 = performance.now();
      fetchWithAuthRetry("/api/admin/system-status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Snap | null) => {
          if (cancelled || !d) return;
          setSnap(d);
          setPingMs(Math.round(performance.now() - t0));
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 25_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!snap) return null;

  /** Bara e informativă — verde discret când totul e OK; detalii pe /admin/system */
  const palette =
    snap.overall === "critical"
      ? "bg-zinc-100 border-b border-red-200 text-zinc-800"
      : snap.overall === "warn"
        ? "bg-zinc-100 border-b border-amber-200 text-zinc-800"
        : "bg-emerald-50 border-b border-emerald-200 text-emerald-950";

  const dbLabel =
    snap.db.status === "up"
      ? `DB OK${snap.db.latencyMs != null ? ` ${snap.db.latencyMs}ms` : ""}`
      : snap.db.status === "skipped"
        ? "DB: mod fără Prisma"
        : "DB: problemă";

  return (
    <div className={`border-b px-3 py-2 text-xs sm:text-sm ${palette}`}>
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <Activity
          className={`w-4 h-4 shrink-0 opacity-90 ${snap.overall === "ok" ? "text-emerald-700" : ""}`}
          aria-hidden
        />
        <span className="font-semibold">
          {snap.overall === "ok"
            ? "Sistem în parametri"
            : snap.overall === "warn"
              ? "Atenție — verifică"
              : "Alertă — investighează"}
        </span>
        <span className="opacity-90 hidden sm:inline">·</span>
        <span>{dbLabel}</span>
        <span className="opacity-90">·</span>
        <span>
          Erori {snap.errors.windowMinutes}m: <strong>{snap.errors.count}</strong>
        </span>
        <span className="opacity-90">·</span>
        <span>RAM heap ~{snap.memory.heapUsedMb} MB</span>
        {snap.vitals.avgLcpLast20 != null && (
          <>
            <span className="opacity-90">·</span>
            <span>LCP mediu ~{snap.vitals.avgLcpLast20} ms</span>
          </>
        )}
        {pingMs != null && (
          <>
            <span className="opacity-90">·</span>
            <span>API admin {pingMs} ms</span>
          </>
        )}
        {snap.overallReasons.length > 0 && (
          <span className="w-full sm:w-auto text-[11px] text-zinc-600 mt-0.5 sm:mt-0 line-clamp-2 sm:line-clamp-none">
            {snap.overallReasons.join(" · ")}
          </span>
        )}
        {snap.product?.shortStrip && (
          <span
            className={`w-full text-[11px] mt-1 sm:mt-0.5 leading-snug ${
              snap.product.webrtc?.summaryOk ? "text-zinc-600" : "text-amber-900 font-medium"
            }`}
          >
            <span className="text-zinc-500">Apeluri / mesaje:</span> {snap.product.shortStrip}
            {!snap.product.webrtc?.summaryOk && (
              <span className="text-zinc-600 font-normal"> — env ≠ apel reușit; vezi /admin/system</span>
            )}
          </span>
        )}
        <Link
          href="/admin/system"
          className="ml-auto inline-flex items-center gap-0.5 font-medium text-brand-700 underline-offset-2 hover:underline shrink-0"
        >
          Vezi detalii <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
