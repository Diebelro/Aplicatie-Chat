"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { isImageContentType, isPdfContentType } from "@/lib/chatAttachments";

type Message = {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string;
  attachmentUrl?: string | null;
  attachmentContentType?: string | null;
};

type UserBrief = { id: string; name?: string; email?: string };

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
  if (isImageContentType(m.attachmentContentType ?? "") || isPdfContentType(m.attachmentContentType ?? "")) {
    return m.attachmentUrl ?? `/api/chat/attachment?messageId=${encodeURIComponent(m.id)}`;
  }
  return m.attachmentUrl ?? null;
}

export default function AdminConversationPage() {
  const params = useParams();
  const id = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [userA, setUserA] = useState<UserBrief | null>(null);
  const [userB, setUserB] = useState<UserBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuthRetry("/api/admin/conversations/" + id)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then((data) => {
        setMessages((data.messages ?? []).map((m: Message & { at?: Date }) => ({ ...m, at: m.at ? new Date(m.at).toISOString() : "" })));
        setUserA(data.userA ?? null);
        setUserB(data.userB ?? null);
      })
      .catch(() => setError("Conversatie negasita sau id invalid (foloseste userId1_userId2)."))
      .finally(() => setLoading(false));
  }, [id]);

  const deleteMessage = (messageId: string) => {
    if (!confirm("Stergi acest mesaj?")) return;
    setDeletingId(messageId);
    fetchWithAuthRetry("/api/admin/messages/" + messageId, { method: "DELETE" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setMessages((prev) => prev.filter((m) => m.id !== messageId)))
      .finally(() => setDeletingId(null));
  };

  if (loading) return <p className="text-dark-400">Se incarca...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  const labelForId = (uid: string) => {
    if (userA && uid === userA.id) return displayUser(userA);
    if (userB && uid === userB.id) return displayUser(userB);
    return uid;
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/admin/conversations" className="text-dark-400 hover:text-white text-sm">
          ← Înapoi la căutare
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-2">Conversație</h1>
      <p className="text-dark-500 text-xs font-mono mb-4 break-all">ID: {id}</p>
      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap gap-3 text-sm">
        {userA && (
          <span className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2">
            <span className="text-dark-500">Participant 1 · </span>
            <span className="text-dark-100">{displayUser(userA)}</span>{" "}
            <Link href={"/admin/users/" + userA.id} className="text-brand-400 hover:underline">
              Profil
            </Link>
          </span>
        )}
        {userB && (
          <span className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2">
            <span className="text-dark-500">Participant 2 · </span>
            <span className="text-dark-100">{displayUser(userB)}</span>{" "}
            <Link href={"/admin/users/" + userB.id} className="text-brand-400 hover:underline">
              Profil
            </Link>
          </span>
        )}
      </div>
      <p className="text-dark-500 text-sm mb-4">
        {messages.length} mesaj{messages.length === 1 ? "" : "e"} · ordine cronologică
      </p>
      <div className="space-y-4">
        {messages.map((m) => {
          const attachHref = attachmentDisplayUrl(m);
          const showImage =
            attachHref && isImageContentType(m.attachmentContentType ?? "");
          const fromLabel = labelForId(m.fromId);
          const toLabel = labelForId(m.toId);
          const fromIsA = userA && m.fromId === userA.id;
          const borderClass = fromIsA ? "border-l-brand-500" : "border-l-amber-500";
          return (
            <div
              key={m.id}
              className={`rounded-r-lg border border-dark-600 border-l-4 ${borderClass} bg-dark-800/80 pl-4 pr-3 py-3 flex justify-between items-start gap-4`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-dark-100 font-medium">{fromLabel}</span>
                  <span className="text-dark-500 text-sm">→ {toLabel}</span>
                  <span className="text-dark-500 text-sm tabular-nums">· {formatMessageAt(m.at)}</span>
                </div>
                {m.text ? (
                  <p className="text-dark-100 text-base leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
                ) : null}
                {showImage ? (
                  <a
                    href={attachHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg overflow-hidden border border-dark-600 max-w-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview; URL externă sau publică */}
                    <img src={attachHref} alt="" className="max-h-64 w-auto object-contain" />
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
                {m.attachmentUrl && !showImage && !isPdfContentType(m.attachmentContentType ?? "") ? (
                  <p className="mt-3 text-dark-400 text-sm break-all">
                    Atașament:{" "}
                    <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                      {m.attachmentUrl}
                    </a>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => deleteMessage(m.id)}
                disabled={deletingId === m.id}
                className="text-red-400 hover:underline text-sm disabled:opacity-50 shrink-0 pt-0.5"
              >
                Șterge
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
