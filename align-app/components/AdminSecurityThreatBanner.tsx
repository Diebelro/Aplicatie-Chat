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
      className="mb-0 border-b border-red-200 bg-red-50/90 px-4 py-2.5 text-zinc-800"
      role="alert"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-zinc-900">
            Securitate: semnale ridicate în ultimele {snap.windowMinutes ?? 15} min
          </p>
          <p className="text-zinc-600 text-xs mt-0.5">
            Ridicate: <strong className="text-zinc-800">{snap.highCount}</strong> · medii:{" "}
            <strong className="text-zinc-800">{snap.mediumCount}</strong> · minore:{" "}
            <strong className="text-zinc-800">{snap.lowCount}</strong>
          </p>
        </div>
        <Link
          href="/admin/security"
          className="shrink-0 text-sm font-medium text-red-700 hover:text-red-800 underline underline-offset-2"
        >
          Detalii
        </Link>
      </div>
    </div>
  );
}
