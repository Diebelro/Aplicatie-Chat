"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PhoneOff } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { intlLocaleTag } from "@/lib/i18n/intlLocale";
import { AppProLoading } from "@/components/AppProLoading";

interface MissedItem {
  fromId: string;
  fromName: string;
  at: string;
  audioOnly: boolean;
}

export default function MissedCallsPage() {
  const { locale, tStr } = useI18n();
  const formatWhen = useCallback(
    (iso: string): string => {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60_000) return tStr("pages.missedCalls.timeJustNow");
      if (diff < 3600_000)
        return formatTpl(tStr("pages.missedCalls.timeMinAgo"), { n: Math.floor(diff / 60_000) });
      if (diff < 86400_000)
        return formatTpl(tStr("pages.missedCalls.timeHourAgo"), { n: Math.floor(diff / 3600_000) });
      return d.toLocaleDateString(intlLocaleTag(locale), {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [locale, tStr]
  );

  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchWithAuthRetry("/api/call/missed", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.missed) setMissed(d.missed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const clearList = () => {
    setClearing(true);
    fetchWithAuthRetry("/api/call/missed", {
      method: "POST",
    })
      .then(() => setMissed([]))
      .finally(() => setClearing(false));
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto">
        <AppProLoading variant="list" label={tStr("pages.missedCalls.loading")} className="py-16" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="app-pro-page-title mb-2">{tStr("pages.missedCalls.title")}</h1>
      <p className="app-pro-lead mb-6">{tStr("pages.missedCalls.subtitle")}</p>

      {missed.length === 0 ? (
        <div className="app-pro-empty">
          <p className="app-pro-lead">{tStr("pages.missedCalls.empty")}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {missed.map((m, i) => (
              <li
                key={`${m.fromId}-${m.at}-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-dark-800 border border-dark-600 shadow-sm"
              >
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <PhoneOff className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 truncate">
                    {formatTpl(
                      m.audioOnly
                        ? tStr("pages.missedCalls.callAudioFrom")
                        : tStr("pages.missedCalls.callVideoFrom"),
                      {
                        name:
                          m.fromName.trim() !== ""
                            ? m.fromName
                            : tStr("pages.callRoom.fallbackUserName"),
                      }
                    )}
                  </p>
                  <p className="text-dark-500 text-sm">{formatWhen(m.at)}</p>
                </div>
                <Link
                  href={`/app/chat/${m.fromId}`}
                  className="text-sm px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 shrink-0"
                >
                  {tStr("pages.missedCalls.messages")}
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
            {clearing ? tStr("pages.missedCalls.clearing") : tStr("pages.missedCalls.clearList")}
          </button>
        </>
      )}

      <Link
        href="/app/messages"
        className="inline-block mt-6 text-brand-400 hover:underline text-sm"
      >
        {tStr("pages.missedCalls.backMessages")}
      </Link>
    </div>
  );
}
