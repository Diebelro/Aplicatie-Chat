"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/authClient";

type Snapshot = {
  shouldAlert: boolean;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  windowMinutes?: number;
};

export function AdminSecurityThreatBanner() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWithAuthRetry("/api/admin/security-threats?windowMin=15", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Snapshot | null) => {
          if (!cancelled && d) setSnap(d);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 25_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!snap?.shouldAlert) return null;

  return (
    <div
      className={
        "mb-0 border-b-2 border-red-500 bg-red-950/95 px-4 py-3 text-red-50 shadow-[0_0_24px_rgba(239,68,68,0.35)] " +
        "animate-pulse motion-reduce:animate-none"
      }
      role="alert"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
        <ShieldAlert className="w-6 h-6 shrink-0 text-red-300" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-100 text-sm sm:text-base">
            Avertisment securitate: activitate suspectă sau abuz detectat
          </p>
          <p className="text-red-200/90 text-xs sm:text-sm mt-0.5">
            Ridicate: <strong>{snap.highCount}</strong> · medii: <strong>{snap.mediumCount}</strong> · minore:{" "}
            <strong>{snap.lowCount}</strong>
            {snap.windowMinutes != null ? (
              <span className="text-red-300/80"> (ultimele {snap.windowMinutes} min, pe acest server)</span>
            ) : null}
          </p>
        </div>
        <Link
          href="/admin/security"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium border border-red-400/50"
        >
          Vezi detalii
        </Link>
      </div>
    </div>
  );
}
