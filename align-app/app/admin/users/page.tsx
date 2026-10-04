"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { markSectionReviewed } from "@/lib/adminModerationCheckpoint";
import { isImageContentType } from "@/lib/chatAttachments";
import {
  MODERATION_CATEGORY_LABELS,
  scanMessageForCategories,
  type ModerationCategoryId,
} from "@/lib/moderationScan";
import {
  Clock,
  ShieldAlert,
  Trash2,
  Search,
  Image as ImageIcon,
  MessageSquare,
  X,
  AlertTriangle,
} from "lucide-react";
import { SkeletonAdminUserCards } from "@/components/perceived/AppShellLoadingLayout";
import { BanReasonDialog } from "@/components/admin/BanReasonDialog";
import type { BanReasonCode } from "@/lib/banReasons";

type UserRow = {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  banUntil: string | null;
  createdAt: string;
  username?: string | null;
  name?: string | null;
};

type ProfilePhotoRow = {
  id: string;
  url: string;
  order: number;
  createdAt: string;
};

type ConvRow = {
  conversationId: string;
  userA: { id: string; email?: string; name?: string; username?: string };
  userB: { id: string; email?: string; name?: string; username?: string };
  lastMessage: { text: string; at: string };
  messageCount: number;
  photoCount?: number;
  flags?: string[];
};

type ChatMessage = {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string;
  attachmentUrl?: string | null;
  attachmentContentType?: string | null;
};

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
}

function labelPeer(c: ConvRow, meId: string): string {
  const other = c.userA.id === meId ? c.userB : c.userA;
  return (other.username || other.name || other.email || other.id).trim();
}

function AdminModerationWorkspace() {
  const searchParams = useSearchParams();
  const preselect = searchParams?.get("id")?.trim() || searchParams?.get("q")?.trim() || "";

  const [search, setSearch] = useState(preselect);
  const [debounced, setDebounced] = useState(preselect);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selected, setSelected] = useState<UserRow | null>(null);
  const [photos, setPhotos] = useState<ProfilePhotoRow[]>([]);
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const [openConvId, setOpenConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [pendingBan, setPendingBan] = useState<null | { userId: string; action: "BAN" | "SUSPEND"; hours?: number }>(
    null
  );
  const [pendingPhoto, setPendingPhoto] = useState<null | { userId: string; photoId?: string; all?: boolean }>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (preselect) setSearch(preselect);
  }, [preselect]);

  const loadUsers = useCallback(() => {
    if (debounced.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchWithAuthRetry("/api/admin/users?search=" + encodeURIComponent(debounced))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        const list = (data.users ?? []).map((u: UserRow & { createdAt: Date; banUntil: Date | null }) => ({
          ...u,
          banUntil: u.banUntil ? new Date(u.banUntil).toISOString() : null,
          createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString("ro-RO") : "",
        })) as UserRow[];
        setUsers(list);
        markSectionReviewed("users");
        if (list.length === 1) setSelected(list[0]);
      })
      .catch(() => setError("Eroare la căutare."))
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadPanel = useCallback((userId: string) => {
    setPanelLoading(true);
    setOpenConvId(null);
    setMessages([]);
    Promise.all([
      fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId) + "/photos").then((r) =>
        r.ok ? r.json() : { photos: [] }
      ),
      fetchWithAuthRetry(
        "/api/admin/conversations?userId=" + encodeURIComponent(userId) + "&limit=40"
      ).then((r) => (r.ok ? r.json() : { conversations: [] })),
    ])
      .then(([ph, cv]) => {
        setPhotos((ph.photos ?? []) as ProfilePhotoRow[]);
        setConvs((cv.conversations ?? []) as ConvRow[]);
      })
      .catch(() => {
        setPhotos([]);
        setConvs([]);
      })
      .finally(() => setPanelLoading(false));
  }, []);

  useEffect(() => {
    if (selected) loadPanel(selected.id);
  }, [selected, loadPanel]);

  const openConversation = (conversationId: string) => {
    if (openConvId === conversationId) {
      setOpenConvId(null);
      setMessages([]);
      return;
    }
    setOpenConvId(conversationId);
    setMsgLoading(true);
    fetchWithAuthRetry("/api/admin/conversations/" + encodeURIComponent(conversationId))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setMessages(
          ((d.messages ?? []) as ChatMessage[]).map((m) => ({
            ...m,
            at: m.at ? new Date(m.at).toISOString() : "",
          }))
        );
      })
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false));
  };

  const deletePhoto = (photoId: string) => {
    if (!selected) return;
    setPendingPhoto({ userId: selected.id, photoId });
  };

  const deleteAllPhotos = () => {
    if (!selected) return;
    setPendingPhoto({ userId: selected.id, all: true });
  };

  const confirmPendingPhoto = (payload: { reasonCode: BanReasonCode; reasonNote: string }) => {
    if (!pendingPhoto) return;
    const { userId, photoId, all } = pendingPhoto;
    setPendingPhoto(null);
    setBusyId(userId);
    fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId) + "/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(all ? { all: true } : { photoId }),
        reasonCode: payload.reasonCode,
        reasonNote: payload.reasonNote,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => loadPanel(userId))
      .catch(() => setError("Eroare la ștergerea pozei."))
      .finally(() => setBusyId(null));
  };

  const runBan = (userId: string, payload: Record<string, unknown>) => {
    setBusyId(userId);
    setError(null);
    fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId) + "/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || "Eroare")))))
      .then(() => {
        loadUsers();
        if (selected?.id === userId) {
          fetchWithAuthRetry("/api/admin/users?search=" + encodeURIComponent(userId))
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              const u = (d?.users ?? []).find((x: UserRow) => x.id === userId);
              if (u) {
                setSelected({
                  ...u,
                  banUntil: u.banUntil ? new Date(u.banUntil).toISOString() : null,
                  createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString("ro-RO") : "",
                });
              }
            });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => setBusyId(null));
  };

  const suspend = (userId: string, hours: number) => {
    if (!confirm(`Suspendare ${hours}h? Contul nu se poate loga până expiră.`)) return;
    setPendingBan({ userId, action: "SUSPEND", hours });
  };

  const banPermanent = (userId: string) => {
    setPendingBan({ userId, action: "BAN" });
  };

  const confirmPendingBan = (payload: { reasonCode: BanReasonCode; reasonNote: string }) => {
    if (!pendingBan) return;
    const { userId, action, hours } = pendingBan;
    setPendingBan(null);
    if (action === "SUSPEND") {
      runBan(userId, {
        action: "SUSPEND",
        hours,
        reasonCode: payload.reasonCode,
        reasonNote: payload.reasonNote,
      });
      return;
    }
    runBan(userId, {
      action: "BAN",
      reasonCode: payload.reasonCode,
      reasonNote: payload.reasonNote,
    });
  };

  const unban = (userId: string) => {
    if (!confirm("Deblochezi contul?")) return;
    runBan(userId, { action: "UNBAN" });
  };

  const deleteUser = (userId: string, email: string) => {
    if (!confirm(`Ștergi definitiv contul ${email}? Ireversibil.`)) return;
    setBusyId(userId);
    fetchWithAuthRetry("/api/admin/users/" + encodeURIComponent(userId), { method: "DELETE" })
      .then((r) => (r.ok ? undefined : Promise.reject()))
      .then(() => {
        setSelected(null);
        setPhotos([]);
        setConvs([]);
        loadUsers();
      })
      .catch(() => setError("Eroare ștergere."))
      .finally(() => setBusyId(null));
  };

  const untilLabel = selected ? formatUntil(selected.banUntil) : null;
  const activeTemp = !!(selected?.banUntil && new Date(selected.banUntil) > new Date());

  return (
    <div className="max-w-4xl">
      <BanReasonDialog
        open={!!pendingBan}
        title={
          pendingBan?.action === "SUSPEND"
            ? `Motiv suspendare ${pendingBan.hours}h`
            : "Motiv ban — îl vede utilizatorul"
        }
        confirmLabel={pendingBan?.action === "SUSPEND" ? "Suspendă" : "Ban permanent"}
        onCancel={() => setPendingBan(null)}
        onConfirm={confirmPendingBan}
      />
      <BanReasonDialog
        open={!!pendingPhoto}
        title={pendingPhoto?.all ? "Motiv ștergere toate pozele" : "Motiv ștergere poză"}
        confirmLabel="Șterge și anunță"
        defaultCode="photo"
        hint="Utilizatorul primește mesaj în chat cu motivul. Alege una din opțiuni."
        onCancel={() => setPendingPhoto(null)}
        onConfirm={confirmPendingPhoto}
      />
      <h1 className="text-2xl font-semibold mb-1">Moderare</h1>
      <p className="text-dark-400 text-sm mb-4">
        Totul pe o pagină: cauți userul → vezi <strong className="text-zinc-800">poze</strong>,{" "}
        <strong className="text-zinc-800">chat-uri</strong> și poți <strong className="text-zinc-800">șterge / ban</strong>{" "}
        fără să schimbi meniul.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" aria-hidden />
        <input
          type="search"
          autoFocus
          placeholder="Username, email, nume sau id… (ex: sorinioan)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-dark-700 border-2 border-brand-500/40 rounded-xl pl-11 pr-4 py-3.5 text-zinc-900 text-base"
        />
      </div>

      {error ? <p className="text-red-400 text-sm mb-3">{error}</p> : null}

      {debounced.length < 2 ? (
        <p className="text-dark-500 text-sm">Scrie cel puțin 2 caractere ca să cauți.</p>
      ) : loading ? (
        <SkeletonAdminUserCards rows={2} />
      ) : users.length === 0 ? (
        <p className="text-dark-500 text-sm">Niciun utilizator găsit.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-5">
          {users.slice(0, 12).map((u) => {
            const active = selected?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected(u)}
                className={`rounded-lg px-3 py-2 text-sm border transition ${
                  active
                    ? "border-brand-500 bg-brand-500/20 text-zinc-900 font-medium"
                    : "border-dark-600 bg-dark-800 text-dark-300 hover:bg-dark-700"
                }`}
              >
                {u.username || u.name || u.email}
              </button>
            );
          })}
          {users.length > 12 ? (
            <span className="text-xs text-dark-500 self-center">+{users.length - 12} alții — rafinează căutarea</span>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className="rounded-2xl border-2 border-brand-500/30 bg-dark-800/90 p-4 sm:p-5 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-zinc-900">
                {selected.username || selected.name || selected.email}
              </p>
              <p className="text-dark-300 text-sm">{selected.email}</p>
              {selected.username ? <p className="text-dark-500 text-xs">@{selected.username}</p> : null}
              <p className="text-dark-500 text-xs font-mono mt-1 break-all">{selected.id}</p>
              {(selected.isBanned || activeTemp) && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-amber-200 text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  {activeTemp && untilLabel
                    ? `Suspendat până la ${untilLabel}`
                    : "Blocat"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setPhotos([]);
                setConvs([]);
                setOpenConvId(null);
              }}
              className="inline-flex items-center gap-1 text-sm text-dark-400 hover:text-zinc-900"
            >
              <X className="w-4 h-4" /> Închide
            </button>
          </div>

          {/* Acțiuni */}
          <div>
            <p className="text-xs uppercase tracking-wide text-dark-500 mb-2">Acțiuni cont</p>
            <div className="flex flex-wrap gap-2">
              {[1, 6, 24, 72].map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={busyId === selected.id}
                  onClick={() => suspend(selected.id, h)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-sm font-semibold"
                >
                  <Clock className="w-4 h-4" />
                  {h}h
                </button>
              ))}
              <button
                type="button"
                disabled={busyId === selected.id}
                onClick={() => banPermanent(selected.id)}
                className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-45 text-sm text-white font-medium"
              >
                Ban
              </button>
              <button
                type="button"
                disabled={busyId === selected.id || (!selected.isBanned && !activeTemp)}
                onClick={() => unban(selected.id)}
                className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-35 text-sm font-medium"
              >
                Deblochează
              </button>
              <button
                type="button"
                disabled={busyId === selected.id}
                onClick={() => deleteUser(selected.id, selected.email)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-45 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Șterge cont
              </button>
            </div>
          </div>

          {/* Poze */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-zinc-900 inline-flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                Poze profil ({photos.length})
              </p>
              {photos.length > 0 ? (
                <button
                  type="button"
                  disabled={busyId === selected.id}
                  onClick={deleteAllPhotos}
                  className="px-2.5 py-1 rounded-md bg-red-800 hover:bg-red-700 text-xs text-white"
                >
                  Șterge toate pozele
                </button>
              ) : null}
            </div>
            {panelLoading ? (
              <p className="text-dark-500 text-sm">Se încarcă…</p>
            ) : photos.length === 0 ? (
              <p className="text-dark-500 text-sm">Nicio poză pe profil.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {photos.map((ph) => (
                  <li key={ph.id} className="rounded-lg border border-dark-600 overflow-hidden bg-dark-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="w-full max-h-72 object-contain bg-black/30" />
                    <div className="p-2 flex justify-end">
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => deletePhoto(ph.id)}
                        className="px-3 py-1.5 rounded-md bg-red-700 hover:bg-red-600 text-xs text-white font-medium"
                      >
                        Șterge poza
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Chat-uri */}
          <div>
            <p className="text-sm font-semibold text-zinc-900 inline-flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-4 h-4 text-brand-400" />
              Chat-uri ({convs.length})
            </p>
            {panelLoading ? (
              <p className="text-dark-500 text-sm">Se încarcă…</p>
            ) : convs.length === 0 ? (
              <p className="text-dark-500 text-sm">Nicio conversație.</p>
            ) : (
              <ul className="space-y-2">
                {convs.map((c) => {
                  const open = openConvId === c.conversationId;
                  const flags = c.flags ?? [];
                  return (
                    <li key={c.conversationId} className="rounded-xl border border-dark-600 bg-dark-900/30 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => openConversation(c.conversationId)}
                        className="w-full text-left px-3 py-2.5 hover:bg-dark-700/50"
                      >
                        <p className="text-sm font-medium text-zinc-900">
                          cu {labelPeer(c, selected.id)}
                          <span className="text-dark-500 font-normal">
                            {" "}
                            · {c.messageCount} mesaje
                            {(c.photoCount ?? 0) > 0 ? ` · ${c.photoCount} poze` : ""}
                          </span>
                        </p>
                        <p className="text-xs text-dark-400 line-clamp-1 mt-0.5">{c.lastMessage.text}</p>
                        {flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {flags.map((f) => (
                              <span
                                key={f}
                                className="rounded px-1.5 py-0.5 text-[10px] bg-amber-700 text-white"
                              >
                                {MODERATION_CATEGORY_LABELS[f as ModerationCategoryId] || f}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-[11px] text-brand-400 mt-1">
                          {open ? "Ascunde chat ↓" : "Deschide chat aici →"}
                        </p>
                      </button>
                      {open ? (
                        <div className="border-t border-dark-600 px-3 py-3 max-h-[420px] overflow-y-auto space-y-3 bg-dark-950/40">
                          {msgLoading ? (
                            <p className="text-dark-500 text-sm">Se încarcă mesajele…</p>
                          ) : messages.length === 0 ? (
                            <p className="text-dark-500 text-sm">Gol.</p>
                          ) : (
                            messages.map((m) => {
                              const flagsMsg = scanMessageForCategories(m.text || "");
                              const isPhoto = isImageContentType(m.attachmentContentType ?? "");
                              const imgUrl =
                                isPhoto &&
                                (m.attachmentUrl ||
                                  `/api/chat/attachment?messageId=${encodeURIComponent(m.id)}`);
                              return (
                                <div
                                  key={m.id}
                                  className={`rounded-lg border-l-4 pl-3 py-2 ${
                                    flagsMsg.includes("sexual") || flagsMsg.includes("threats")
                                      ? "border-l-fuchsia-500 bg-fuchsia-950/20"
                                      : isPhoto
                                        ? "border-l-sky-400 bg-sky-950/20"
                                        : "border-l-dark-500 bg-dark-800/50"
                                  }`}
                                >
                                  <p className="text-[11px] text-dark-500 tabular-nums mb-0.5">
                                    {m.fromId === selected.id ? "El/ea" : "Celălalt"} ·{" "}
                                    {m.at
                                      ? new Date(m.at).toLocaleString("ro-RO", {
                                          dateStyle: "short",
                                          timeStyle: "short",
                                        })
                                      : ""}
                                  </p>
                                  {flagsMsg.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {flagsMsg.map((f) => (
                                        <span
                                          key={f}
                                          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] bg-amber-700 text-white"
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          {MODERATION_CATEGORY_LABELS[f as ModerationCategoryId] || f}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                  {m.text ? (
                                    <p className="text-sm text-zinc-900 whitespace-pre-wrap break-words">
                                      {m.text}
                                    </p>
                                  ) : null}
                                  {imgUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={imgUrl}
                                      alt=""
                                      className="mt-1 max-h-48 rounded border border-sky-500/40"
                                    />
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <p className="text-dark-500 text-xs mt-6">
        Scanare în masă (opțional):{" "}
        <Link href="/admin/moderation-scan" className="text-brand-400 hover:underline">
          Scanare conținut
        </Link>
      </p>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl p-4">
          <SkeletonAdminUserCards rows={2} />
        </div>
      }
    >
      <AdminModerationWorkspace />
    </Suspense>
  );
}
