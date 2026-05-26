"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, UserRound } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { formatRelativePast } from "@/lib/formatRelativeVisit";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { OptimizedImage } from "@/components/OptimizedImage";
import { AppProLoading } from "@/components/AppProLoading";

const LS_LAST_SEEN = "align_profile_visits_last_seen";

type VisitRow = {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  lastVisitedAt: string;
  firstVisitedAt: string;
  hasMatchOrChat: boolean;
};

export default function ProfileVisitsPage() {
  const { tStr, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listEnabled, setListEnabled] = useState(true);
  const [visits, setVisits] = useState<VisitRow[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LAST_SEEN, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchWithAuthRetry("/api/profile/visits", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(typeof d.error === "string" ? d.error : tStr("pages.profileVisits.errLoad"));
          setVisits([]);
          return;
        }
        setListEnabled(d.listEnabled !== false);
        setVisits(Array.isArray(d.visits) ? d.visits : []);
        setError(null);
      })
      .catch(() => setError(tStr("pages.profileVisits.errNetwork")))
      .finally(() => setLoading(false));
  }, [tStr]);

  if (loading) {
    return <AppProLoading variant="list" label={tStr("pages.profileVisits.loading")} className="py-24" />;
  }

  return (
    <div className="max-w-lg mx-auto px-5 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/app/profile" className="text-sm text-brand-400 hover:underline">
          {tStr("pages.profileVisits.backProfile")}
        </Link>
        <h1 className="app-pro-page-title mt-3">{tStr("pages.profileVisits.title")}</h1>
        <p className="ui-subtitle text-sm mt-2 text-dark-400">{tStr("pages.profileVisits.intro")}</p>
      </div>

      {error && (
        <div className="app-pro-empty mb-6">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {!listEnabled && (
        <div className="rounded-2xl border border-dark-600 bg-dark-800/40 p-4 mb-6">
          <p className="text-sm text-dark-200">{tStr("pages.profileVisits.listDisabled")}</p>
          <p className="text-xs text-dark-500 mt-2">{tStr("pages.profileVisits.listDisabledHint")}</p>
          <Link href="/app/profile" className="inline-block mt-3 text-sm text-brand-400 hover:underline">
            {tStr("pages.profileVisits.openPrivacy")}
          </Link>
        </div>
      )}

      {listEnabled && visits.length === 0 && !error && (
        <p className="text-sm text-dark-400">{tStr("pages.profileVisits.empty")}</p>
      )}

      {listEnabled && visits.length > 0 && (
        <ul className="space-y-3">
          {visits.map((v) => {
            const rel = formatRelativePast(v.lastVisitedAt, locale);
            return (
              <li
                key={v.userId}
                className="flex gap-3 items-center rounded-2xl border border-dark-600 bg-dark-800/30 p-3"
              >
                <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-dark-700 border border-dark-600">
                  {v.photoUrl ? (
                    <OptimizedImage src={v.photoUrl} alt="" width={48} height={48} className="w-full h-full object-cover" />
                  ) : (
                    <SilhouetteAvatar className="w-full h-full" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-dark-100 truncate">{v.displayName}</p>
                  <p className="text-xs text-dark-500">
                    {tStr("pages.profileVisits.visitedPrefix")} {rel}
                  </p>
                  <p className="text-xs text-dark-500 mt-0.5">
                    {v.hasMatchOrChat ? tStr("pages.profileVisits.statusMatch") : tStr("pages.profileVisits.statusNoMatch")}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col gap-1.5 items-end">
                  {v.hasMatchOrChat ? (
                    <Link
                      href={`/app/chat/${v.userId}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-300 border border-brand-500/40 hover:bg-brand-500/30"
                    >
                      <MessageCircle className="w-3.5 h-3.5" aria-hidden />
                      {tStr("pages.profileVisits.btnMessage")}
                    </Link>
                  ) : (
                    <Link
                      href={`/app/user/${v.userId}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-dark-700 px-3 py-1.5 text-xs text-dark-200 border border-dark-600 hover:bg-dark-600"
                    >
                      <UserRound className="w-3.5 h-3.5" aria-hidden />
                      {tStr("pages.profileVisits.btnViewProfile")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
