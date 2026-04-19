"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  markModerationReviewedNow,
  readModerationSince,
  ADMIN_MODERATION_CHECKPOINT_KEY,
} from "@/lib/adminModerationCheckpoint";
import { Users, Flag, ShieldAlert, Sparkles, Scale, MessageSquareText } from "lucide-react";

type Summary = {
  since: string;
  totalUsers: number;
  bannedUsers: number;
  totalReports: number;
  signupsLast24Hours: number;
  signupsLast7Days: number;
  signupsLast15Days: number;
  signupsLast30Days: number;
  reportsLast24Hours: number;
  reportsLast7Days: number;
  reportsLast15Days: number;
  reportsLast30Days: number;
  newUsersSince: number;
  newReportsSince: number;
  newAppFeedbackSince: number;
  pendingBanAppeals: number;
  attentionCount: number;
};

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckpoint, setHasCheckpoint] = useState(false);

  const load = useCallback(() => {
    setError(null);
    const since = readModerationSince();
    setHasCheckpoint(typeof window !== "undefined" && !!localStorage.getItem(ADMIN_MODERATION_CHECKPOINT_KEY));
    const q = new URLSearchParams({ since: since.toISOString() });
    fetchWithAuthRetry("/api/admin/summary?" + q)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((d: Summary) => setSummary(d))
      .catch(() => setError("Nu s-a putut încărca rezumatul."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onMarkReviewed = () => {
    markModerationReviewedNow();
    load();
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Dashboard Admin</h1>
      <p className="text-dark-400 text-sm mb-6">
        Aici vezi câți utilizatori sunt în tot sistemul, câți sunt blocați, câte rapoarte există și ce s-a
        întâmplat <strong className="text-dark-200">după ultima ta verificare</strong> (sau ultimele 7 zile, până
        apeși „Am verificat”). Numărul roșu include{' '}
        <strong className="text-dark-200">contestările la blocare</strong> în așteptare și{' '}
        <strong className="text-dark-200">feedback-ul app</strong> nou după același moment.
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {!summary && !error ? (
        <p className="text-dark-400">Se încarcă...</p>
      ) : summary ? (
        <>
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 px-4 py-4 mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" aria-hidden />
              <h2 className="text-lg font-semibold text-amber-100">Noutăți de urmărit</h2>
              {summary.attentionCount > 0 ? (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-zinc-900">
                  {summary.attentionCount} de verificat
                </span>
              ) : (
                <span className="text-dark-500 text-sm">— nimic nou față de punctul curent</span>
              )}
            </div>
            <p className="text-dark-400 text-xs mb-3">
              Referință:{" "}
              <span className="text-dark-300 tabular-nums">
                {new Date(summary.since).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              {!hasCheckpoint ? (
                <span className="text-dark-500"> (implicit: ultimele 7 zile — salvează un punct cu butonul de mai jos)</span>
              ) : null}
            </p>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <li className="rounded-lg bg-dark-800/80 border border-dark-600 px-3 py-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400 shrink-0" />
                <span>
                  <strong className="text-dark-100">{summary.newUsersSince}</strong> înscrieri noi după acest moment
                </span>
              </li>
              <li className="rounded-lg bg-dark-800/80 border border-dark-600 px-3 py-2 flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-dark-100">{summary.newReportsSince}</strong> rapoarte noi după acest moment
                </span>
              </li>
              <li className="rounded-lg bg-dark-800/80 border border-red-900/40 px-3 py-2 flex items-center gap-2 sm:col-span-2 lg:col-span-1">
                <Scale className="w-4 h-4 text-red-300 shrink-0" aria-hidden />
                <span>
                  <strong className="text-dark-100">{summary.pendingBanAppeals ?? 0}</strong> contestări blocare în așteptare
                  {(summary.pendingBanAppeals ?? 0) > 0 ? (
                    <>
                      {" "}
                      <Link href="/admin/ban-appeals" className="text-brand-400 hover:underline">
                        → deschide
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
              <li className="rounded-lg bg-dark-800/80 border border-dark-600 px-3 py-2 flex items-center gap-2 sm:col-span-2 lg:col-span-1">
                <MessageSquareText className="w-4 h-4 text-sky-400 shrink-0" aria-hidden />
                <span>
                  <strong className="text-dark-100">{summary.newAppFeedbackSince ?? 0}</strong> mesaje feedback app după acest moment
                  {(summary.newAppFeedbackSince ?? 0) > 0 ? (
                    <>
                      {" "}
                      <Link href="/admin/app-feedback" className="text-brand-400 hover:underline">
                        → deschide
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            </ul>
            <p className="text-dark-500 text-xs mt-3">
              Conturile nu se șterg singure când cineva &quot;pleacă&quot; din app — dacă trebuie scos cineva din baza de date, o faci
              manual din pagina user (Șterge user). Lista de mai sus te ajută să vezi cine <em>a apărut nou</em> ca să decizi dacă îl lași sau îl elimini.
            </p>
            <button
              type="button"
              onClick={onMarkReviewed}
              className="mt-4 w-full sm:w-auto px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-dark-900 font-medium text-sm"
            >
              Am verificat — de acum arăt doar ce e nou după acum
            </button>
          </div>

          <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wide mb-3">Situație generală</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            <div className="rounded-xl border border-dark-600 bg-dark-800/60 p-4">
              <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
                <Users className="w-4 h-4" />
                Total utilizatori
              </div>
              <p className="text-2xl font-semibold text-zinc-900">{summary.totalUsers}</p>
              <ul className="text-dark-500 text-xs mt-2 space-y-1 tabular-nums">
                <li>
                  Ultimele 24 h: <strong className="text-dark-300">+{summary.signupsLast24Hours}</strong> înscrieri
                </li>
                <li>
                  Ultimele 7 zile: <strong className="text-dark-300">+{summary.signupsLast7Days}</strong> înscrieri
                </li>
                <li>
                  Ultimele 15 zile: <strong className="text-dark-300">+{summary.signupsLast15Days}</strong> înscrieri
                </li>
                <li>
                  Ultimele 30 zile: <strong className="text-dark-300">+{summary.signupsLast30Days}</strong> înscrieri
                </li>
              </ul>
              <p className="text-dark-600 text-[11px] mt-2 leading-snug">
                Ferestre rulante (de acum înapoi) — utile la buget reclamă / facturare la ~15 zile.
              </p>
            </div>
            <div className="rounded-xl border border-dark-600 bg-dark-800/60 p-4">
              <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
                <Flag className="w-4 h-4" />
                Rapoarte (total)
              </div>
              <p className="text-2xl font-semibold text-zinc-900">{summary.totalReports}</p>
              <ul className="text-dark-500 text-xs mt-2 space-y-1 tabular-nums">
                <li>
                  Ultimele 24 h: <strong className="text-dark-300">{summary.reportsLast24Hours}</strong> rapoarte
                </li>
                <li>
                  Ultimele 7 zile: <strong className="text-dark-300">{summary.reportsLast7Days}</strong> rapoarte
                </li>
                <li>
                  Ultimele 15 zile: <strong className="text-dark-300">{summary.reportsLast15Days}</strong> rapoarte
                </li>
                <li>
                  Ultimele 30 zile: <strong className="text-dark-300">{summary.reportsLast30Days}</strong> rapoarte
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-red-300/90 text-sm mb-1">
                <ShieldAlert className="w-4 h-4" />
                Conturi blocate (ban admin)
              </div>
              <p className="text-2xl font-semibold text-red-200">{summary.bannedUsers}</p>
              <p className="text-dark-500 text-xs mt-1">
                Aceștia nu se pot autentifica până la Unban. Nu înseamnă că și-au șters contul.
              </p>
            </div>
          </div>
        </>
      ) : null}

      <h2 className="text-sm font-medium text-dark-300 uppercase tracking-wide mb-2">Scurtături</h2>
      <ul className="space-y-2">
        <li>
          <Link href="/admin/users" className="text-brand-400 hover:underline">
            Gestionează useri
          </Link>
        </li>
        <li>
          <Link href="/admin/reports" className="text-brand-400 hover:underline">
            Rapoarte
          </Link>
        </li>
        <li>
          <Link href="/admin/app-feedback" className="text-brand-400 hover:underline">
            Feedback app (sugestii utilizatori)
          </Link>
        </li>
        <li>
          <Link href="/admin/ban-appeals" className="text-brand-400 hover:underline">
            Contestări blocare (utilizatori care cer deblocare)
          </Link>
        </li>
        <li>
          <Link href="/admin/logs" className="text-brand-400 hover:underline">
            Loguri acțiuni admin
          </Link>
        </li>
        <li>
          <Link href="/admin/conversations" className="text-brand-400 hover:underline">
            Vizualizare conversație (id: userId1_userId2)
          </Link>
        </li>
        <li>
          <Link href="/admin/moderation-scan" className="text-brand-400 hover:underline">
            Scanare text / atașamente (amenințări, sexual, injurii, indicatori minori)
          </Link>
        </li>
        <li>
          <Link href="/admin/system" className="text-brand-400 hover:underline">
            Bord sistem — DB, erori, memorie, LCP, plus apeluri (WebRTC/semnalizare) și pipeline mesaje
          </Link>
        </li>
      </ul>
    </div>
  );
}
