"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";
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
  const [userA, setUserA] = useState<{ id: string; name?: string; email?: string } | null>(null);
  const [userB, setUserB] = useState<{ id: string; name?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/conversations/" + id, { headers: getAuthHeaders(), credentials: "include" })
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
    fetch("/api/admin/messages/" + messageId, { method: "DELETE", headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setMessages((prev) => prev.filter((m) => m.id !== messageId)))
      .finally(() => setDeletingId(null));
  };

  if (loading) return <p className="text-dark-400">Se incarca...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Conversatie</h1>
      <p className="text-dark-400 mb-2">Id: {id}</p>
      <div className="mb-4 flex gap-4">
        {userA && <span>User A: {userA.email ?? userA.id} <Link href={"/admin/users/" + userA.id} className="text-brand-400">Profil</Link></span>}
        {userB && <span>User B: {userB.email ?? userB.id} <Link href={"/admin/users/" + userB.id} className="text-brand-400">Profil</Link></span>}
      </div>
      <div className="space-y-2">
        {messages.map((m) => {
          const attachHref = attachmentDisplayUrl(m);
          const showImage =
            attachHref && isImageContentType(m.attachmentContentType ?? "");
          return (
            <div key={m.id} className="bg-dark-700 rounded p-2 flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1">
                  <span className="text-dark-400 text-sm">{m.at}</span>
                  <span className="mx-2 font-mono text-sm">
                    {m.fromId.slice(0, 8)} -&gt; {m.toId.slice(0, 8)}
                  </span>
                </div>
                {m.text ? <p className="text-dark-200 text-sm mb-2 whitespace-pre-wrap break-words">{m.text}</p> : null}
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
                  <p className="mt-2 text-dark-400 text-xs break-all">
                    Atașament:{" "}
                    <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                      {m.attachmentUrl}
                    </a>
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => deleteMessage(m.id)}
                disabled={deletingId === m.id}
                className="text-red-400 hover:underline text-sm disabled:opacity-50 shrink-0"
              >
                Sterge
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
