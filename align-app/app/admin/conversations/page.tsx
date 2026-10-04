"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchWithAuthRetry } from "@/lib/authClient";
import {
  MODERATION_CATEGORY_LABELS,
  type ModerationCategoryId,
} from "@/lib/moderationScan";
import { AlertTriangle, Image as ImageIcon, MessageSquare, Search } from "lucide-react";
import { SkeletonFormPanel } from "@/components/perceived/AppShellLoadingLayout";

type ConvRow = {
  conversationId: string;
  userA: { id: string; email?: string; name?: string; username?: string };
  userB: { id: string; email?: string; name?: string; username?: string };
  lastMessage: { text: string; at: string; fromId: string; hasAttachment?: boolean };
  messageCount: number;
  photoCount?: number;
  attachmentCount?: number;
  flags?: string[];
  lastHasAttachment?: boolean;
};

const FLAG_STYLE: Record<string, string> = {
  minors: "bg-red-600 text-white",
  threats: "bg-orange-600 text-white",
  sexual: "bg-fuchsia-700 text-white",
  insults: "bg-amber-700 text-white",
  scams: "bg-yellow-600 text-zinc-900",
  illegal_trade: "bg-red-800 text-white",
  bot_automation: "bg-slate-600 text-white",
};

function labelUser(u: { email?: string; name?: string; username?: string; id: string }): string {
  return (u.username || u.name || u.email || u.id).trim();
}

function subUser(u: { email?: string; username?: string; id: string }): string {
  const bits = [u.username, u.email].filter(Boolean);
  if (bits.length) return bits.join(" · ");
  return u.id.slice(0, 10) + "…";
}

function AdminConversationsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const withUser = searchParams?.get("with")?.trim() || "";

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [hasPhotos, setHasPhotos] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(t);
  }, [q]);

  // Deschide direct dacă lipești un conversationId complet (cuid_cuid)
  useEffect(() => {
    const s = debouncedQ;
    if (!s.includes("_")) return;
    const parts = s.split("_").filter(Boolean);
    if (parts.length === 2 && parts[0].length >= 20 && parts[1].length >= 20) {
      router.push("/admin/conversations/" + encodeURIComponent(s));
    }
  }, [debouncedQ, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "50" });
    if (withUser) params.set("userId", withUser);
    else if (debouncedQ.length >= 2) params.set("q", debouncedQ);
    if (hasPhotos) params.set("hasPhotos", "1");
    if (flaggedOnly) params.set("flagged", "1");
    if (category) params.set("category", category);
    fetchWithAuthRetry("/api/admin/conversations?" + params)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((d) => setRows((d.conversations ?? []) as ConvRow[]))
      .catch(() => setError("Nu s-au putut încărca conversațiile."))
      .finally(() => setLoading(false));
  }, [debouncedQ, withUser, hasPhotos, flaggedOnly, category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Conversații</h1>
      <p className="text-dark-400 text-sm mb-4">
        Caută după email, username, nume, <strong className="text-dark-300 font-medium">ID user</strong> sau lipește{" "}
        <strong className="text-dark-300 font-medium">ID conversație</strong> (userA_userB). Badge-urile marchează
        poze și limbaj riscant (sexual, amenințări, etc.).
        {withUser ? (
          <>
            {" "}
            Filtru: chat-uri ale userului{" "}
            <code className="text-xs text-dark-300">{withUser.slice(0, 12)}…</code>{" "}
            <Link href="/admin/conversations" className="text-brand-400 hover:underline">
              (vezi toate)
            </Link>
          </>
        ) : null}
      </p>

      {!withUser ? (
        <div className="mb-4 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email, username, ID user sau ID conversație…"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-9 pr-3 py-2.5 text-zinc-900 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-2.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm shrink-0"
          >
            Reîncarcă
          </button>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2 items-center text-sm">
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-dark-600 bg-dark-800 px-2.5 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={hasPhotos}
            onChange={(e) => setHasPhotos(e.target.checked)}
            className="accent-brand-500"
          />
          <ImageIcon className="w-3.5 h-3.5 text-sky-400" aria-hidden />
          <span>Doar cu poze</span>
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-dark-600 bg-dark-800 px-2.5 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="accent-brand-500"
          />
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden />
          <span>Doar semnalate</span>
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-dark-600 bg-dark-800 px-2.5 py-1.5 text-sm text-zinc-900"
        >
          <option value="">Toate categoriile</option>
          {(Object.keys(MODERATION_CATEGORY_LABELS) as ModerationCategoryId[]).map((id) => (
            <option key={id} value={id}>
              {MODERATION_CATEGORY_LABELS[id]}
            </option>
          ))}
        </select>
        <Link
          href="/admin/moderation-scan"
          className="text-xs text-brand-400 hover:underline ml-auto"
        >
          Scan moderare detaliat →
        </Link>
      </div>

      {error ? <p className="text-red-400 text-sm mb-4">{error}</p> : null}

      {loading ? (
        <SkeletonFormPanel />
      ) : rows.length === 0 ? (
        <p className="text-dark-500 text-sm">
          {debouncedQ.length >= 2 || withUser || hasPhotos || flaggedOnly || category
            ? "Nicio conversație găsită pentru filtrul curent."
            : "Nu există conversații recente."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const flags = c.flags ?? [];
            const photos = c.photoCount ?? 0;
            const hot =
              flags.includes("minors") || flags.includes("threats") || flags.includes("sexual");
            return (
              <li key={c.conversationId}>
                <button
                  type="button"
                  onClick={() =>
                    router.push("/admin/conversations/" + encodeURIComponent(c.conversationId))
                  }
                  className={`w-full text-left rounded-xl border px-4 py-3 transition touch-manipulation ${
                    hot
                      ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15"
                      : "border-dark-600 bg-dark-800/80 hover:bg-dark-700/80 hover:border-brand-500/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare
                      className={`w-5 h-5 shrink-0 mt-0.5 ${hot ? "text-amber-400" : "text-brand-400"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {labelUser(c.userA)}
                        <span className="text-dark-500 font-normal"> ↔ </span>
                        {labelUser(c.userB)}
                      </p>
                      <p className="text-[11px] text-dark-500 mt-0.5 truncate">
                        {subUser(c.userA)} · {subUser(c.userB)}
                      </p>
                      <p className="text-xs text-dark-500 mt-0.5 tabular-nums">
                        {c.messageCount} mesaje ·{" "}
                        {new Date(c.lastMessage.at).toLocaleString("ro-RO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                        {photos > 0 ? (
                          <span className="text-sky-400"> · {photos} poz{photos === 1 ? "ă" : "e"}</span>
                        ) : null}
                      </p>
                      {(flags.length > 0 || photos > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {photos > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-sky-700 text-white">
                              <ImageIcon className="w-3 h-3" aria-hidden />
                              Poze
                            </span>
                          ) : null}
                          {flags.map((f) => (
                            <span
                              key={f}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                FLAG_STYLE[f] || "bg-dark-600 text-zinc-200"
                              }`}
                            >
                              {MODERATION_CATEGORY_LABELS[f as ModerationCategoryId] || f}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-dark-300 mt-1 line-clamp-2">{c.lastMessage.text}</p>
                    </div>
                    <span className="text-brand-400 text-sm shrink-0 self-center">Citește →</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminConversationsListPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl p-4 space-y-4">
          <div className="h-8 w-72 rounded-lg bg-dark-700/40 animate-pulse" />
          <SkeletonFormPanel />
        </div>
      }
    >
      <AdminConversationsBrowser />
    </Suspense>
  );
}
