"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhoneOff } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";

interface MissedItem {
  fromId: string;
  fromName: string;
  at: string;
  audioOnly: boolean;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "acum puțin";
  if (diff < 3600_000) return `acum ${Math.floor(diff / 60_000)} min`;
  if (diff < 86400_000) return `acum ${Math.floor(diff / 3600_000)} h`;
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MissedCallsPage() {
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetch("/api/call/missed", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.missed) setMissed(d.missed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const clearList = () => {
    setClearing(true);
    fetch("/api/call/missed", {
      method: "POST",
      headers: getAuthHeaders(),
    })
      .then(() => setMissed([]))
      .finally(() => setClearing(false));
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-dark-500">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-2">Apeluri pierdute</h1>
      <p className="text-dark-500 text-sm mb-6">
        Apeluri la care nu ai răspuns. Poți suna înapoi din chat.
      </p>

      {missed.length === 0 ? (
        <p className="text-dark-500 text-center py-8">Niciun apel pierdut.</p>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {missed.map((m, i) => (
              <li
                key={`${m.fromId}-${m.at}-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-dark-800 border border-dark-600"
              >
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <PhoneOff className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 truncate">
                    Apel {m.audioOnly ? "audio" : "video"} de la {m.fromName}
                  </p>
                  <p className="text-dark-500 text-sm">{formatWhen(m.at)}</p>
                </div>
                <Link
                  href={`/app/chat/${m.fromId}`}
                  className="text-sm px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 shrink-0"
                >
                  Mesaje
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={clearList}
            disabled={clearing}
            className="w-full py-2.5 rounded-xl border border-dark-600 text-dark-400 hover:bg-dark-800 hover:text-zinc-900 transition disabled:opacity-50 text-sm"
          >
            {clearing ? "Se șterge..." : "Șterge lista"}
          </button>
        </>
      )}

      <Link
        href="/app/messages"
        className="inline-block mt-6 text-brand-400 hover:underline text-sm"
      >
        ← Înapoi la mesaje
      </Link>
    </div>
  );
}
