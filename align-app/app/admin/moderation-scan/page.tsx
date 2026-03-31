"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  AlertTriangle,
  Image as ImageIcon,
  Search,
  FileText,
  Sparkles,
  Loader2,
  MessagesSquare,
} from "lucide-react";
import {
  MODERATION_CATEGORY_LABELS,
  type ModerationCategoryId,
} from "@/lib/moderationScan";

type Row = {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  createdAt: string;
  fromEmail: string;
  toEmail: string;
  matchedCategories: ModerationCategoryId[];
  hasAttachment?: boolean;
};

type AiReportRow = Row & {
  aiFlags: string[];
  aiNoteRo: string;
  aiSeverity?: "low" | "medium" | "high";
};

const CAT_OPTS: { id: ModerationCategoryId; label: string }[] = (
  Object.entries(MODERATION_CATEGORY_LABELS) as [ModerationCategoryId, string][]
).map(([id, label]) => ({ id, label }));

const AI_FLAG_LABELS: Record<string, string> = {
  none: "Fără semnal",
  threats: "Amenințări",
  sexual: "Limbaj sexual explicit",
  insults: "Insulte / jigniri",
  minors: "Minori / grooming",
  spam: "Spam",
  harassment: "Hărțuire",
  scams: "Țeapă / înșelăciune",
  illegal_trade: "Droguri / ilegal / furt",
  bot_automation: "Bot / automat / cont neuman",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "Prioritate ridicată",
  medium: "Prioritate medie",
  low: "Prioritate redusă",
};

const convKey = (a: string, b: string) => [a, b].sort().join("_");

export default function AdminModerationScanPage() {
  const [mode, setMode] = useState<"text" | "attachments">("text");
  const [selectedCats, setSelectedCats] = useState<Set<ModerationCategoryId>>(
    () =>
      new Set<ModerationCategoryId>([
        "threats",
        "sexual",
        "insults",
        "minors",
        "scams",
        "illegal_trade",
        "bot_automation",
      ])
  );
  const [limit, setLimit] = useState(150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Record<string, string> | null>(null);

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiLimit, setAiLimit] = useState(25);
  const [onlyAiFlagged, setOnlyAiFlagged] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDisclaimer, setAiDisclaimer] = useState<string | null>(null);
  const [aiRows, setAiRows] = useState<AiReportRow[]>([]);
  const [threadByConv, setThreadByConv] = useState<
    Record<
      string,
      { summary_ro: string; concerns: string[]; severity_hint: string; disclaimer?: string }
    >
  >({});
  const [threadLoadingConv, setThreadLoadingConv] = useState<string | null>(null);
  /** Sub ce mesaj afișăm ultimul rezumat cerut pentru perechea de utilizatori. */
  const [threadAnchorMsgId, setThreadAnchorMsgId] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchWithAuthRetry("/api/admin/moderation-ai-report")
      .then((r) => (r.ok ? r.json() : Promise.resolve({ configured: false })))
      .then((d) => setAiConfigured(Boolean(d.configured)))
      .catch(() => setAiConfigured(false));
  }, []);

  const toggleCat = (id: ModerationCategoryId) => {
    setSelectedCats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ mode, limit: String(limit) });
    if (mode === "text" && selectedCats.size > 0 && selectedCats.size < CAT_OPTS.length) {
      q.set("categories", Array.from(selectedCats).join(","));
    }
    fetchWithAuthRetry("/api/admin/moderation-scan?" + q)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || "Eroare")))))
      .then((d) => {
        setRows(d.results ?? []);
        setLabels(d.labels ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => setLoading(false));
  }, [mode, limit, selectedCats]);

  const convoPath = (a: string, b: string) =>
    "/admin/conversations/" + [a, b].sort().join("_");

  const runAiReport = useCallback(() => {
    setAiLoading(true);
    setAiError(null);
    fetchWithAuthRetry("/api/admin/moderation-ai-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: aiLimit }),
    })
      .then((r) =>
        r.ok ? r.json() : r.json().then((j: { error?: string }) => Promise.reject(new Error(j.error || "Eroare")))
      )
      .then((d: { disclaimer?: string; items?: AiReportRow[] }) => {
        setAiDisclaimer(d.disclaimer ?? null);
        setAiRows(d.items ?? []);
      })
      .catch((e) => setAiError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => setAiLoading(false));
  }, [aiLimit]);

  const filteredAiRows = onlyAiFlagged
    ? aiRows.filter(
        (r) => (r.aiFlags ?? []).length > 0 && !(r.aiFlags.length === 1 && r.aiFlags[0] === "none")
      )
    : aiRows;

  const sortedAiRows = useMemo(() => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...filteredAiRows].sort((a, b) => {
      const sa = order[a.aiSeverity ?? "low"] ?? 2;
      const sb = order[b.aiSeverity ?? "low"] ?? 2;
      if (sa !== sb) return sa - sb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredAiRows]);

  const aiBatchStats = useMemo(() => {
    const flagged = aiRows.filter(
      (r) => !(r.aiFlags?.length === 1 && r.aiFlags[0] === "none")
    );
    const bySev = { high: 0, medium: 0, low: 0 };
    const byFlag: Record<string, number> = {};
    for (const r of flagged) {
      const sev = r.aiSeverity ?? "low";
      if (sev in bySev) bySev[sev as keyof typeof bySev] += 1;
      for (const f of r.aiFlags ?? []) {
        if (f === "none") continue;
        byFlag[f] = (byFlag[f] ?? 0) + 1;
      }
    }
    return { total: aiRows.length, flagged: flagged.length, bySev, byFlag };
  }, [aiRows]);

  const fetchThreadBrief = useCallback(async (fromUserId: string, toUserId: string, messageId: string) => {
    const k = convKey(fromUserId, toUserId);
    setThreadAnchorMsgId((prev) => ({ ...prev, [k]: messageId }));
    setThreadLoadingConv(k);
    setAiError(null);
    try {
      const res = await fetchWithAuthRetry("/api/admin/moderation-ai-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, limit: 30 }),
      });
      const data = (await res.json()) as {
        summary_ro?: string;
        concerns?: string[];
        severity_hint?: string;
        disclaimer?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Eroare rezumat conversație");
      setThreadByConv((prev) => ({
        ...prev,
        [k]: {
          summary_ro: data.summary_ro ?? "",
          concerns: Array.isArray(data.concerns) ? data.concerns : [],
          severity_hint: data.severity_hint ?? "low",
          disclaimer: data.disclaimer,
        },
      }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Eroare.");
    } finally {
      setThreadLoadingConv(null);
    }
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Scanare conținut (moderare)</h1>
      <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 px-4 py-3 text-sm text-dark-200 mb-4 flex gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p>
            Aici nu e inteligență artificială — sunt <strong className="text-dark-50">potriviri simple</strong> pe text.
            Există <strong className="text-dark-50">false positive</strong>. Pentru abuz real (în special implicând minori),{" "}
            verifică contextul, conversația întreagă și, dacă e cazul, <strong className="text-dark-50">raportează autorităților</strong>{" "}
            conform legii.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-violet-600/35 bg-violet-950/15 px-4 py-3 text-sm text-dark-200 mb-4">
        <div className="flex items-start gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-dark-100 mb-1">Raport AI (doar sugestii)</p>
            <p className="text-dark-400 text-xs leading-relaxed">
              Modelul clasifică ultimele mesaje cu text și îți arată etichete + o notă scurtă în română.
              <strong className="text-dark-200"> Nu se întâmplă nimic automat</strong> în aplicație — doar îți
              ușurează parcurgerea. Mesajele pleacă către OpenAI; folosește doar dacă e ok din punct de vedere
              privacy și cost.
            </p>
          </div>
        </div>
        {aiConfigured === false && (
          <p className="text-amber-400/90 text-xs mb-3">
            AI dezactivat: setează <code className="text-dark-200">OPENAI_API_KEY</code> pe server (vezi
            .env.example), apoi repornește aplicația.
          </p>
        )}
        {aiConfigured === null && (
          <p className="text-dark-500 text-xs mb-3">Se verifică configurația…</p>
        )}
        {aiDisclaimer && (
          <p className="text-violet-200/80 text-xs mb-3 border-l-2 border-violet-500 pl-2">{aiDisclaimer}</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-dark-500 mb-1">Mesaje (batch AI)</label>
            <input
              type="number"
              min={5}
              max={50}
              value={aiLimit}
              onChange={(e) => setAiLimit(Math.min(50, Math.max(5, Number(e.target.value) || 25)))}
              disabled={!aiConfigured}
              className="w-24 bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-zinc-900 text-sm disabled:opacity-45"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-dark-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyAiFlagged}
              onChange={(e) => setOnlyAiFlagged(e.target.checked)}
              className="rounded border-dark-600"
            />
            Afișează doar rândurile cu semnal (nu „none”)
          </label>
          <button
            type="button"
            disabled={!aiConfigured || aiLoading}
            onClick={runAiReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-45 text-sm font-semibold"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? "Raport…" : "Generează raport AI"}
          </button>
        </div>
        {aiError && <p className="text-red-400 text-xs mt-3">{aiError}</p>}
        {aiRows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs border-t border-dark-600 pt-3">
            <span className="text-dark-500">
              Batch: <strong className="text-dark-200">{aiBatchStats.flagged}</strong> cu semnal din{" "}
              <strong className="text-dark-200">{aiBatchStats.total}</strong>
            </span>
            {aiBatchStats.flagged > 0 && (
              <>
                <span className="text-dark-600">·</span>
                <span className="text-red-300/90">Ridicată: {aiBatchStats.bySev.high}</span>
                <span className="text-amber-200/90">Medie: {aiBatchStats.bySev.medium}</span>
                <span className="text-dark-400">Redusă: {aiBatchStats.bySev.low}</span>
              </>
            )}
            {Object.keys(aiBatchStats.byFlag).length > 0 && (
              <>
                <span className="text-dark-600 w-full sm:w-auto sm:ml-1">Etichete:</span>
                {Object.entries(aiBatchStats.byFlag).map(([fid, n]) => (
                  <span key={fid} className="text-violet-200/85">
                    {AI_FLAG_LABELS[fid] ?? fid}: {n}
                  </span>
                ))}
              </>
            )}
          </div>
        )}
        {sortedAiRows.length > 0 && (
          <ul className="mt-4 space-y-3 border-t border-dark-600 pt-4">
            {sortedAiRows.map((r) => (
              <li key={r.id} className="rounded-xl border border-violet-900/50 bg-dark-900/50 p-4">
                <div className="flex flex-wrap gap-2 text-xs text-dark-500 mb-2 items-center">
                  <span className="tabular-nums">
                    {new Date(r.createdAt).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  {r.aiSeverity && r.aiSeverity !== "low" && (
                    <span
                      className={`px-2 py-0.5 rounded font-medium ${
                        r.aiSeverity === "high"
                          ? "bg-red-900/50 text-red-100"
                          : "bg-amber-900/45 text-amber-100"
                      }`}
                    >
                      {SEVERITY_LABELS[r.aiSeverity] ?? r.aiSeverity}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(r.aiFlags ?? []).map((f) => (
                    <span
                      key={f}
                      className={`text-xs px-2 py-0.5 rounded ${
                        f === "minors" ||
                          f === "threats" ||
                          f === "scams" ||
                          f === "illegal_trade"
                          ? "bg-red-900/55 text-red-200"
                          : f === "bot_automation"
                            ? "bg-sky-900/50 text-sky-100"
                          : f === "none"
                            ? "bg-dark-700 text-dark-400"
                            : "bg-violet-900/45 text-violet-100"
                      }`}
                    >
                      {AI_FLAG_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
                {r.aiNoteRo ? (
                  <p className="text-violet-200/90 text-xs mb-2 italic">{r.aiNoteRo}</p>
                ) : null}
                <p className="text-dark-100 text-sm whitespace-pre-wrap break-words mb-2">{r.text}</p>
                <div className="text-xs text-dark-400 space-y-1">
                  <p>
                    De la:{" "}
                    <Link href={"/admin/users/" + r.fromUserId} className="text-brand-400 hover:underline">
                      {r.fromEmail}
                    </Link>
                  </p>
                  <p>
                    Către:{" "}
                    <Link href={"/admin/users/" + r.toUserId} className="text-brand-400 hover:underline">
                      {r.toEmail}
                    </Link>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 items-center">
                  <Link
                    href={convoPath(r.fromUserId, r.toUserId)}
                    className="text-brand-400 hover:underline text-sm"
                  >
                    Deschide conversația
                  </Link>
                  {aiConfigured && (
                    <button
                      type="button"
                      disabled={threadLoadingConv !== null}
                      onClick={() => void fetchThreadBrief(r.fromUserId, r.toUserId, r.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 disabled:opacity-45"
                    >
                      {threadLoadingConv === convKey(r.fromUserId, r.toUserId) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <MessagesSquare className="w-3.5 h-3.5" aria-hidden />
                      )}
                      Rezumat AI (context conversație)
                    </button>
                  )}
                </div>
                {(() => {
                  const tk = convKey(r.fromUserId, r.toUserId);
                  const tb = threadByConv[tk];
                  if (!tb || threadAnchorMsgId[tk] !== r.id) return null;
                  return (
                    <div className="mt-3 rounded-lg border border-violet-800/40 bg-violet-950/25 px-3 py-2 text-xs space-y-2">
                      {tb.disclaimer ? (
                        <p className="text-dark-500 leading-snug border-l-2 border-violet-600 pl-2">{tb.disclaimer}</p>
                      ) : null}
                      <p className="text-dark-100 leading-relaxed whitespace-pre-wrap">{tb.summary_ro}</p>
                      {tb.severity_hint && tb.severity_hint !== "low" && (
                        <p className="text-dark-400">
                          Estimare context:{" "}
                          <strong
                            className={
                              tb.severity_hint === "high" ? "text-red-300" : "text-amber-200"
                            }
                          >
                            {tb.severity_hint === "high"
                              ? "ridicată"
                              : tb.severity_hint === "medium"
                                ? "medie"
                                : "redusă"}
                          </strong>
                        </p>
                      )}
                      {tb.concerns.length > 0 && (
                        <ul className="list-disc list-inside text-dark-300 space-y-0.5">
                          {tb.concerns.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
        {!aiLoading && aiRows.length > 0 && filteredAiRows.length === 0 && onlyAiFlagged && (
          <p className="text-dark-500 text-xs mt-3">
            AI nu a semnalat nimic în acest batch (sau toate sunt „none”). Debifează filtrul sau încearcă un batch
            mai mare.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            mode === "text" ? "bg-brand-600 text-white" : "bg-dark-700 text-dark-300 hover:text-zinc-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          Scanare după text
        </button>
        <button
          type="button"
          onClick={() => setMode("attachments")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            mode === "attachments" ? "bg-brand-600 text-white" : "bg-dark-700 text-dark-300 hover:text-zinc-900"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Mesaje cu poză / fișier
        </button>
      </div>

      {mode === "text" && (
        <div className="mb-4">
          <p className="text-dark-400 text-xs mb-2">Categorii scanate (bifează cel puțin una):</p>
          <div className="flex flex-wrap gap-2">
            {CAT_OPTS.map((c) => (
              <label
                key={c.id}
                className={`cursor-pointer px-3 py-1.5 rounded-lg border text-sm ${
                  selectedCats.has(c.id)
                    ? "border-brand-500 bg-brand-500/20 text-brand-100"
                    : "border-dark-600 text-dark-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedCats.has(c.id)}
                  onChange={() => toggleCat(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-dark-500 mb-1">Max. rezultate</label>
          <input
            type="number"
            min={20}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.min(500, Math.max(20, Number(e.target.value) || 150)))}
            className="w-24 bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-zinc-900 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={loading || (mode === "text" && selectedCats.size === 0)}
          onClick={run}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-45 text-sm font-semibold"
        >
          <Search className="w-4 h-4" />
          {loading ? "Scanare…" : "Rulează scanarea"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {rows.length === 0 && !loading ? (
        <p className="text-dark-500 text-sm">Apasă „Rulează scanarea”. Dacă nu apar rânduri, nu s-au găsit potriviri în ultimele mesaje verificate.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-dark-600 bg-dark-800/80 p-4">
              <div className="flex flex-wrap gap-2 text-xs text-dark-500 mb-2">
                <span className="tabular-nums">
                  {new Date(r.createdAt).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })}
                </span>
                {r.hasAttachment || r.attachmentUrl ? (
                  <span className="text-sky-400">· cu atașament</span>
                ) : null}
              </div>
              {mode === "text" && r.matchedCategories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {r.matchedCategories.map((c) => (
                    <span
                      key={c}
                      className={`text-xs px-2 py-0.5 rounded ${
                        c === "minors" || c === "illegal_trade" || c === "scams"
                          ? "bg-red-900/60 text-red-200"
                          : c === "bot_automation"
                            ? "bg-sky-900/45 text-sky-100"
                            : "bg-amber-900/40 text-amber-200"
                      }`}
                    >
                      {labels?.[c] ?? c}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-dark-100 text-sm whitespace-pre-wrap break-words mb-2">
                {r.text || (r.attachmentUrl ? "— (doar atașament) —" : "—")}
              </p>
              <div className="text-xs text-dark-400 space-y-1">
                <p>
                  De la:{" "}
                  <Link href={"/admin/users/" + r.fromUserId} className="text-brand-400 hover:underline">
                    {r.fromEmail}
                  </Link>
                </p>
                <p>
                  Către:{" "}
                  <Link href={"/admin/users/" + r.toUserId} className="text-brand-400 hover:underline">
                    {r.toEmail}
                  </Link>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={convoPath(r.fromUserId, r.toUserId)}
                  className="text-brand-400 hover:underline text-sm"
                >
                  Deschide conversația
                </Link>
                {r.attachmentUrl ? (
                  <a
                    href={r.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline text-sm"
                  >
                    Vezi atașamentul
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
