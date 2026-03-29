"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";

type Row = {
  id: string;
  userId: string;
  message: string;
  pageUrl: string | null;
  createdAt: string;
  userEmail?: string;
};

export default function AdminAppFeedbackPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuthRetry("/api/admin/app-feedback")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Eroare");
        return d.items as Row[];
      })
      .then((list) => setItems(Array.isArray(list) ? list : []))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-dark-400">Se încarcă…</p>
      </div>
    );
  }
  if (err) {
    return (
      <div className="p-6">
        <p className="text-red-400">{err}</p>
        <Link href="/admin" className="text-brand-400 hover:underline mt-4 inline-block">
          ← Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold mb-2">Feedback aplicație</h1>
      <p className="text-dark-500 text-sm mb-6">
        Sugestii și probleme raportate de utilizatori (nu sunt rapoarte de moderare împotriva altor useri).
      </p>
      {items.length === 0 ? (
        <p className="text-dark-500">Încă nu există mesaje.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="p-4 rounded-xl border border-dark-600 bg-dark-800/80">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-dark-500 mb-2">
                <time dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })}
                </time>
                <span>·</span>
                <span>{r.userEmail ?? r.userId}</span>
                {r.pageUrl && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[min(100%,280px)]" title={r.pageUrl}>
                      {r.pageUrl}
                    </span>
                  </>
                )}
              </div>
              <p className="text-dark-200 text-sm whitespace-pre-wrap break-words">{r.message}</p>
              <Link
                href={`/admin/users/${encodeURIComponent(r.userId)}`}
                className="text-brand-400 hover:underline text-xs mt-2 inline-block"
              >
                Vezi utilizatorul
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
