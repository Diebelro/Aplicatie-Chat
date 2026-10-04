"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { isImageContentType, isPdfContentType } from "@/lib/chatAttachments";
import {
  formatLocationCoordsExact,
  formatLocationPrimaryLine,
  googleMapsUrl,
  isAlignLocationContentType,
  parseAlignLocationPayload,
} from "@/lib/chatLocation";
import {
  MODERATION_CATEGORY_LABELS,
  scanMessageForCategories,
  type ModerationCategoryId,
} from "@/lib/moderationScan";
import { SkeletonChatThread } from "@/components/perceived/AppShellLoadingLayout";
import { AlertTriangle, Image as ImageIcon } from "lucide-react";
import { BanReasonDialog } from "@/components/admin/BanReasonDialog";
import type { BanReasonCode } from "@/lib/banReasons";

type Message = {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string;
  attachmentUrl?: string | null;
  attachmentContentType?: string | null;
  isPlatformNotice?: boolean;
};

type UserBrief = { id: string; name?: string; email?: string };

const FLAG_STYLE: Record<string, string> = {
  minors: "bg-red-600 text-white",
  threats: "bg-orange-600 text-white",
  sexual: "bg-fuchsia-700 text-white",
  insults: "bg-amber-700 text-white",
  scams: "bg-yellow-600 text-zinc-900",
  illegal_trade: "bg-red-800 text-white",
  bot_automation: "bg-slate-600 text-white",
};

function displayUser(u: UserBrief | null): string {
  if (!u) return "?";
  return (u.email || u.name || u.id).trim();
}

function formatMessageAt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function attachmentDisplayUrl(m: Message): string | null {
  if (isAlignLocationContentType(m.attachmentContentType)) return null;
  if (isImageContentType(m.attachmentContentType ?? "") || isPdfContentType(m.attachmentContentType ?? "")) {
    return m.attachmentUrl ?? `/api/chat/attachment?messageId=${encodeURIComponent(m.id)}`;
  }
  return m.attachmentUrl ?? null;
}

export default function AdminConversationPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const [messages, setMessages] = useState<Message[]>([]);
  const [userA, setUserA] = useState<UserBrief | null>(null);
  const [userB, setUserB] = useState<UserBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<"all" | "photos" | "flagged">("all");
  const [pendingBan, setPendingBan] = useState<null | { action: "BAN" | "SUSPEND"; hours?: number }>(null);
  const firstPhotoRef = useRef<HTMLDivElement | null>(null);
  const firstFlagRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchWithAuthRetry("/api/admin/conversations/" + id)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setMessages(
          (data.messages ?? []).map((m: Message & { at?: Date }) => ({
            ...m,
            at: m.at ? new Date(m.at).toISOString() : "",
          }))
        );
        setUserA(data.userA ?? null);
        setUserB(data.userB ?? null);
      })
      .catch(() => setError("Conversatie negasita sau id invalid (foloseste userId1_userId2)."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setActionTargetId((prev) => {
      if (userA && userB) {
        if (prev === userA.id || prev === userB.id) return prev;
        return userB.id;
      }
      return userA?.id ?? userB?.id ?? null;
    });
  }, [userA, userB]);

  const enriched = useMemo(() => {
    return messages.map((m) => {
      const flags = scanMessageForCategories(m.text || "");
      const attachHref = attachmentDisplayUrl(m);
      const isPhoto = !!(attachHref && isImageContentType(m.attachmentContentType ?? ""));
      return { m, flags, attachHref, isPhoto };
    });
  }, [messages]);

  const photoCount = enriched.filter((e) => e.isPhoto).length;
  const flaggedCount = enriched.filter((e) => e.flags.length > 0).length;
  const flagSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of enriched) {
      for (const f of e.flags) map.set(f, (map.get(f) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [enriched]);

  const visible = enriched.filter((e) => {
    if (viewFilter === "photos") return e.isPhoto;
    if (viewFilter === "flagged") return e.flags.length > 0 || e.isPhoto;
    return true;
  });

  const postAction = async (body: Record<string, unknown>) => {
    const res = await fetchWithAuthRetry(
      "/api/admin/conversations/" + encodeURIComponent(id) + "/actions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error ?? "Eroare");
    }
    return res.json().catch(() => ({}));
  };

  const deleteMessage = (messageId: string) => {
    if (!confirm("Stergi acest mesaj?")) return;
    setDeletingId(messageId);
    fetchWithAuthRetry("/api/admin/messages/" + messageId, { method: "DELETE" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setMessages((prev) => prev.filter((m) => m.id !== messageId)))
      .finally(() => setDeletingId(null));
  };

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-4 w-36 rounded bg-dark-700/45 animate-pulse" />
        <SkeletonChatThread />
      </div>
    );
  }
  if (error) return <p className="text-red-400">{error}</p>;

  const labelForId = (uid: string) => {
    if (userA && uid === userA.id) return displayUser(userA);
    if (userB && uid === userB.id) return displayUser(userB);
    return uid;
  };

  return (
    <div className="max-w-3xl">
      <BanReasonDialog
        open={!!pendingBan}
        title={
          pendingBan?.action === "SUSPEND"
            ? `Motiv suspendare ${pendingBan.hours}h`
            : "Motiv ban — îl vede utilizatorul"
        }
        confirmLabel={pendingBan?.action === "SUSPEND" ? "Suspendă" : "Ban permanent"}
        onCancel={() => setPendingBan(null)}
        onConfirm={async (payload: { reasonCode: BanReasonCode; reasonNote: string }) => {
          if (!pendingBan || !actionTargetId) return;
          const { action, hours } = pendingBan;
          setPendingBan(null);
          setActionBusy(action === "BAN" ? "ban" : "suspend");
          try {
            await postAction({
              action,
              targetUserId: actionTargetId,
              ...(action === "SUSPEND" ? { hours } : {}),
              reasonCode: payload.reasonCode,
              reasonNote: payload.reasonNote,
            });
          } catch (e) {
            alert(e instanceof Error ? e.message : "Eroare");
          } finally {
            setActionBusy(null);
          }
        }}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/admin/conversations" className="text-dark-400 hover:text-zinc-900 text-sm">
          ← Înapoi la căutare
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-2">Conversație</h1>
      <p className="text-dark-500 text-xs font-mono mb-4 break-all">ID: {id}</p>

      {(photoCount > 0 || flaggedCount > 0) && (
        <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-zinc-900 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden />
            Atenție moderator
          </p>
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            {photoCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-700 text-white px-2 py-1 font-medium">
                <ImageIcon className="w-3.5 h-3.5" aria-hidden />
                {photoCount} poz{photoCount === 1 ? "ă" : "e"} trimisă/trimise
              </span>
            ) : null}
            {flagSummary.map(([f, n]) => (
              <span
                key={f}
                className={`rounded-md px-2 py-1 font-medium ${FLAG_STYLE[f] || "bg-dark-600 text-zinc-100"}`}
              >
                {MODERATION_CATEGORY_LABELS[f as ModerationCategoryId] || f}: {n}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {photoCount > 0 ? (
              <button
                type="button"
                className="rounded-lg bg-sky-800/80 px-3 py-1.5 text-xs text-white hover:bg-sky-700"
                onClick={() => {
                  setViewFilter("photos");
                  setTimeout(() => firstPhotoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                }}
              >
                Sari la poze
              </button>
            ) : null}
            {flaggedCount > 0 ? (
              <button
                type="button"
                className="rounded-lg bg-amber-800/80 px-3 py-1.5 text-xs text-white hover:bg-amber-700"
                onClick={() => {
                  setViewFilter("flagged");
                  setTimeout(() => firstFlagRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                }}
              >
                Doar mesaje semnalate
              </button>
            ) : null}
            {viewFilter !== "all" ? (
              <button
                type="button"
                className="rounded-lg bg-dark-700 border border-dark-600 px-3 py-1.5 text-xs text-zinc-900 hover:bg-dark-600"
                onClick={() => setViewFilter("all")}
              >
                Arată tot chat-ul
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap gap-3 text-sm">
        {userA && (
          <span className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2">
            <span className="text-dark-500">Participant 1 · </span>
            <span className="text-zinc-900">{displayUser(userA)}</span>{" "}
            <Link href={"/admin/users/" + userA.id} className="text-brand-400 hover:underline">
              Profil
            </Link>
            <span className="block text-[10px] text-dark-500 font-mono mt-0.5 break-all">{userA.id}</span>
          </span>
        )}
        {userB && (
          <span className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2">
            <span className="text-dark-500">Participant 2 · </span>
            <span className="text-zinc-900">{displayUser(userB)}</span>{" "}
            <Link href={"/admin/users/" + userB.id} className="text-brand-400 hover:underline">
              Profil
            </Link>
            <span className="block text-[10px] text-dark-500 font-mono mt-0.5 break-all">{userB.id}</span>
          </span>
        )}
      </div>
      {userA && userB && actionTargetId ? (
        <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm">
          <p className="text-zinc-900 font-medium mb-1">Acțiuni pentru utilizatorul urmărit</p>
          <p className="text-dark-500 text-xs mb-3">
            Avertismentul trimite o notificare generală în chat (fără referință la un mesaj anume). În conversație apare
            ca „Notificare platformă”, nu ca mesaj de la celălalt participant. Notificarea dispare din chat după 30 zile
            (acțiunea rămâne în logurile admin).
          </p>
          <div className="flex flex-wrap gap-3 mb-3 items-center">
            <span className="text-dark-500 text-xs">Țintă:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="modTarget"
                checked={actionTargetId === userA.id}
                onChange={() => setActionTargetId(userA.id)}
                className="accent-brand-400"
              />
              <span className="text-zinc-800">{displayUser(userA)}</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="modTarget"
                checked={actionTargetId === userB.id}
                onChange={() => setActionTargetId(userB.id)}
                className="accent-brand-400"
              />
              <span className="text-zinc-800">{displayUser(userB)}</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!actionBusy}
              className="rounded-lg bg-dark-700 border border-dark-600 px-3 py-1.5 text-xs text-zinc-900 hover:bg-dark-600 disabled:opacity-50"
              onClick={async () => {
                if (
                  !confirm(
                    "Trimiți avertismentul generic în conversația lor? Utilizatorul selectat va vedea o notificare de platformă."
                  )
                )
                  return;
                setActionBusy("warn");
                try {
                  await postAction({ action: "WARN_PLATFORM", targetUserId: actionTargetId });
                  const r = await fetchWithAuthRetry("/api/admin/conversations/" + id);
                  const data = r.ok ? await r.json() : null;
                  if (data?.messages) {
                    setMessages(
                      (data.messages as Message[]).map((m) => ({
                        ...m,
                        at: m.at ? new Date(m.at as unknown as string).toISOString() : "",
                      }))
                    );
                  }
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Eroare");
                } finally {
                  setActionBusy(null);
                }
              }}
            >
              {actionBusy === "warn" ? "…" : "Avertisment în chat"}
            </button>
            <button
              type="button"
              disabled={!!actionBusy}
              className="rounded-lg bg-dark-700 border border-dark-600 px-3 py-1.5 text-xs text-zinc-900 hover:bg-dark-600 disabled:opacity-50"
              onClick={async () => {
                const raw = window.prompt("Suspendare: ore (1–168)?", "24");
                if (raw === null) return;
                const hours = Number(raw);
                if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
                  alert("Introdu un număr de ore între 1 și 168.");
                  return;
                }
                if (!confirm(`Suspendi contul ${actionTargetId?.slice(0, 8)}… ${hours}h?`)) return;
                setPendingBan({ action: "SUSPEND", hours });
              }}
            >
              {actionBusy === "suspend" ? "…" : "Suspendare"}
            </button>
            <button
              type="button"
              disabled={!!actionBusy}
              className="rounded-lg bg-dark-700 border border-red-900/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              onClick={async () => {
                if (!confirm("Blocare permanentă a acestui cont?")) return;
                setPendingBan({ action: "BAN" });
              }}
            >
              {actionBusy === "ban" ? "…" : "Blochează cont"}
            </button>
            <button
              type="button"
              disabled={!!actionBusy}
              className="rounded-lg bg-dark-700 border border-dark-600 px-3 py-1.5 text-xs text-amber-200 hover:bg-dark-600 disabled:opacity-50"
              onClick={async () => {
                if (
                  !confirm(
                    "Ștergi toate mesajele dintre acești doi utilizatori? (Conversația devine goală; conturile rămân.)"
                  )
                )
                  return;
                setActionBusy("thread");
                try {
                  await postAction({ action: "DELETE_THREAD", targetUserId: actionTargetId });
                  setMessages([]);
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Eroare");
                } finally {
                  setActionBusy(null);
                }
              }}
            >
              {actionBusy === "thread" ? "…" : "Șterge tot chat-ul"}
            </button>
            <button
              type="button"
              disabled={!!actionBusy}
              className="rounded-lg bg-red-950/50 border border-red-800 px-3 py-1.5 text-xs text-red-200 hover:bg-red-900/40 disabled:opacity-50"
              onClick={async () => {
                if (
                  !confirm(
                    "ȘTERGERE DEFINITIVĂ a contului utilizatorului selectat? Ireversibil. Rapoarte/match-uri cascadă."
                  )
                )
                  return;
                setActionBusy("deluser");
                try {
                  await postAction({ action: "DELETE_USER", targetUserId: actionTargetId });
                  window.location.href = "/admin/conversations";
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Eroare");
                } finally {
                  setActionBusy(null);
                }
              }}
            >
              {actionBusy === "deluser" ? "…" : "Șterge cont"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <p className="text-dark-500">
          {visible.length}/{messages.length} mesaj{messages.length === 1 ? "" : "e"}
          {viewFilter === "photos" ? " · doar poze" : ""}
          {viewFilter === "flagged" ? " · doar semnalate" : ""}
        </p>
        <div className="flex gap-1 ml-auto">
          {(
            [
              ["all", "Tot"],
              ["photos", "Poze"],
              ["flagged", "Semnalate"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setViewFilter(k)}
              className={`rounded-md px-2.5 py-1 text-xs border ${
                viewFilter === k
                  ? "border-brand-500 bg-brand-500/20 text-zinc-900"
                  : "border-dark-600 bg-dark-800 text-dark-400 hover:bg-dark-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map(({ m, flags, attachHref, isPhoto }, idx) => {
          const locationPt = isAlignLocationContentType(m.attachmentContentType)
            ? parseAlignLocationPayload(m.attachmentUrl ?? null)
            : null;
          const fromLabel = labelForId(m.fromId);
          const toLabel = labelForId(m.toId);
          const fromIsA = userA && m.fromId === userA.id;
          const isFlagged = flags.length > 0;
          const isFirstPhoto = isPhoto && visible.findIndex((v) => v.isPhoto) === idx;
          const isFirstFlag = isFlagged && visible.findIndex((v) => v.flags.length > 0) === idx;

          let borderClass = m.isPlatformNotice
            ? "border-l-amber-400"
            : fromIsA
              ? "border-l-brand-500"
              : "border-l-amber-500";
          let bgClass = "bg-dark-800/80";
          if (flags.includes("minors") || flags.includes("threats")) {
            borderClass = "border-l-red-500";
            bgClass = "bg-red-950/35";
          } else if (flags.includes("sexual")) {
            borderClass = "border-l-fuchsia-500";
            bgClass = "bg-fuchsia-950/30";
          } else if (isPhoto) {
            borderClass = "border-l-sky-400";
            bgClass = "bg-sky-950/25";
          } else if (isFlagged) {
            borderClass = "border-l-orange-400";
            bgClass = "bg-orange-950/25";
          }

          return (
            <div
              key={m.id}
              ref={
                isFirstPhoto
                  ? firstPhotoRef
                  : isFirstFlag
                    ? firstFlagRef
                    : undefined
              }
              className={`rounded-r-lg border border-dark-600 border-l-4 ${borderClass} ${bgClass} pl-4 pr-3 py-3 flex justify-between items-start gap-4`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {m.isPlatformNotice ? (
                    <span className="text-amber-200 text-sm font-medium">Notificare platformă</span>
                  ) : (
                    <>
                      <span className="text-zinc-900 font-medium">{fromLabel}</span>
                      <span className="text-dark-500 text-sm">→ {toLabel}</span>
                    </>
                  )}
                  <span className="text-dark-500 text-sm tabular-nums">· {formatMessageAt(m.at)}</span>
                  {isPhoto ? (
                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-sky-700 text-white">
                      <ImageIcon className="w-3 h-3" aria-hidden />
                      Poză
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
                {m.text ? (
                  <p
                    className={`text-base leading-relaxed whitespace-pre-wrap break-words ${
                      isFlagged ? "text-zinc-50 font-medium" : "text-zinc-900"
                    }`}
                  >
                    {m.text}
                  </p>
                ) : null}
                {isPhoto && attachHref ? (
                  <a
                    href={attachHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block rounded-lg overflow-hidden border-2 border-sky-500/60 max-w-md ring-2 ring-sky-500/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                    <img src={attachHref} alt="Poză trimisă în chat" className="max-h-80 w-auto object-contain" />
                  </a>
                ) : null}
                {attachHref && isPdfContentType(m.attachmentContentType ?? "") ? (
                  <p className="mt-2">
                    <a
                      href={attachHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:underline text-sm"
                    >
                      Deschide PDF (atașament)
                    </a>
                  </p>
                ) : null}
                {locationPt ? (
                  <div className="mt-2 text-sm space-y-1">
                    <p className="text-zinc-900">
                      <span className="text-dark-400">Adresă / poziție: </span>
                      <span className="break-words">{formatLocationPrimaryLine(locationPt, 6)}</span>
                    </p>
                    <p className="text-dark-500 text-xs tabular-nums">
                      WGS84: {formatLocationCoordsExact(locationPt.lat, locationPt.lng, 6)}
                    </p>
                    <a
                      href={googleMapsUrl(locationPt.lat, locationPt.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:underline inline-block"
                    >
                      Google Maps
                    </a>
                  </div>
                ) : null}
                {isAlignLocationContentType(m.attachmentContentType) && m.attachmentUrl && !locationPt ? (
                  <p className="mt-2 text-amber-400/90 text-sm">Locație invalidă (payload).</p>
                ) : null}
                {m.attachmentUrl &&
                !isPhoto &&
                !isPdfContentType(m.attachmentContentType ?? "") &&
                !locationPt &&
                !isAlignLocationContentType(m.attachmentContentType) ? (
                  <p className="mt-3 text-dark-400 text-sm break-all">
                    Atașament:{" "}
                    <a
                      href={m.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:underline"
                    >
                      {m.attachmentUrl}
                    </a>
                  </p>
                ) : null}
              </div>
              {m.isPlatformNotice ? (
                <span className="text-dark-500 text-xs shrink-0">—</span>
              ) : (
                <button
                  type="button"
                  onClick={() => deleteMessage(m.id)}
                  disabled={deletingId === m.id}
                  className="text-red-400 hover:underline text-sm disabled:opacity-50 shrink-0 pt-0.5"
                >
                  Șterge
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
