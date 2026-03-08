"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Video, Phone, CheckCheck } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";
import { track } from "@/lib/tracking";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";

interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string;
  readAt?: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const otherId = params.id as string;
  const [other, setOther] = useState<(User & { online?: boolean; distanceKm?: number; lastActivityAt?: number }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [areFriends, setAreFriends] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [calling, setCalling] = useState<"video" | "audio" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw ? (() => { try { return JSON.parse(meRaw); } catch { return null; } })() : null;

  const fetchOther = async () => {
    const res = await fetch(`/api/users/${otherId}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok && data.user) setOther(data.user);
  };

  const fetchMessages = async () => {
    const res = await fetch(`/api/messages?with=${otherId}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (res.ok) {
      setMessages(data.messages || []);
      setAreFriends(!!data.areFriends);
      setMatchId(data.matchId ?? null);
    }
  };

  useEffect(() => {
    if (!otherId) return;
    (async () => {
      await fetchOther();
      await fetchMessages();
      fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ profileId: otherId }),
      }).then(() => track.view_profile(otherId));
      // Marchează conversația ca citită → scade din badge-ul de necitite
      fetch("/api/me/read", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ otherId }),
      }).catch(() => {});
      setLoading(false);
    })();
  }, [otherId]);

  // Polling mesaje + online (ca WhatsApp) – reîmprospătare la ~1.5s
  useEffect(() => {
    if (!otherId || loading) return;
    const t = setInterval(() => {
      fetchMessages();
      fetchOther();
    }, 1500);
    return () => clearInterval(t);
  }, [otherId, loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const headers = getAuthHeaders() as Record<string, string>;
      if (!headers["x-user-id"]) {
        setSendError("Nu ești autentificat. Reconectează-te.");
        return;
      }
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ toId: otherId, text: text.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setText("");
        track.message_sent(otherId);
      } else {
        setSendError(data.error || "Eroare la trimitere. Încearcă din nou.");
      }
    } catch {
      setSendError("Eroare de rețea. Verifică conexiunea.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă...</span>
      </div>
    );
  }

  if (!other && !me) {
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500 mb-4">Profil negăsit.</p>
        <Link href="/app/profiles" className="text-brand-400 hover:underline">
          Înapoi la profiluri
        </Link>
      </div>
    );
  }

  const otherUser = other || (me?.id === otherId ? me : null);
  const displayNameStr = otherUser ? displayName(otherUser.username ?? otherUser.name) : "Profil";
  const distanceStr =
    other && typeof other.distanceKm === "number"
      ? other.distanceKm < 1
        ? `${Math.round(other.distanceKm * 1000)} m`
        : `${(Math.round(other.distanceKm * 10) / 10).toFixed(1).replace(".", ",")} km`
      : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-3 pb-4 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <Link
            href="/app/profiles"
            className="text-dark-500 hover:text-white transition shrink-0"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate">{displayNameStr}</h2>
            <p className="text-xs text-dark-500 flex items-center gap-2 mt-0.5">
              {distanceStr != null && <span>{distanceStr}</span>}
              {areFriends && (
                <>
                  {distanceStr != null && <span>·</span>}
                  {other?.online ? (
                    <span className="text-green-400">Online</span>
                  ) : other?.lastActivityAt != null ? (
                    <span>
                      Acum {Math.floor((Date.now() - other.lastActivityAt) / 60000)} min
                    </span>
                  ) : (
                    <span>Offline</span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        {me?.id && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-500 shrink-0">Apel:</span>
            <button
              type="button"
              disabled={!!calling}
              onClick={async () => {
                setCalling("video");
                try {
                  await fetch("/api/call/ring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                    body: JSON.stringify({ toId: otherId, audioOnly: false }),
                  });
                } finally {
                  setCalling(null);
                }
                router.push(`/app/call/${getVideoRoomId(me.id, otherId)}?from=ring`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/25 text-brand-400 hover:bg-brand-500/35 border border-brand-500/40 transition disabled:opacity-50"
              title="Apel video"
            >
              <Video className="w-5 h-5" />
              <span className="text-sm font-medium">Video</span>
            </button>
            <button
              type="button"
              disabled={!!calling}
              onClick={async () => {
                setCalling("audio");
                try {
                  await fetch("/api/call/ring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                    body: JSON.stringify({ toId: otherId, audioOnly: true }),
                  });
                } finally {
                  setCalling(null);
                }
                router.push(`/app/call/${getVideoRoomId(me.id, otherId)}?audio=1&from=ring`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-600 text-white hover:bg-dark-500 border border-dark-500 transition disabled:opacity-50"
              title="Apel audio"
            >
              <Phone className="w-5 h-5" />
              <span className="text-sm font-medium">Audio</span>
            </button>
          </div>
        )}
        {me?.id && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-dark-600 mt-2">
          <button
            type="button"
            disabled={actionBusy}
            onClick={async () => {
              if (!confirm("Blochezi acest utilizator? Nu veți mai putea trimite mesaje.")) return;
              setActionBusy(true);
              try {
                const res = await fetch("/api/block", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify({ targetUserId: otherId }),
                });
                if (res.ok) router.replace("/app/profiles");
                else setSendError((await res.json()).error ?? "Eroare");
              } finally {
                setActionBusy(false);
              }
            }}
            className="text-sm text-dark-400 hover:text-amber-400 transition disabled:opacity-50"
          >
            Blochează
          </button>
          <button
            type="button"
            disabled={actionBusy}
            onClick={async () => {
              const reason = window.prompt("Motivul raportului (opțional):");
              if (reason === null) return;
              setActionBusy(true);
              try {
                const res = await fetch("/api/report", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify({ targetUserId: otherId, reason: reason || "Raport din chat" }),
                });
                if (res.ok) setSendError(null);
                else setSendError((await res.json()).error ?? "Eroare");
              } finally {
                setActionBusy(false);
              }
            }}
            className="text-sm text-dark-400 hover:text-amber-400 transition disabled:opacity-50"
          >
            Raportează
          </button>
          {matchId && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={async () => {
                if (!confirm("Anulezi match-ul? Conversația va rămâne, dar nu veți mai apărea unul altuia în lista de match-uri.")) return;
                setActionBusy(true);
                try {
                  const res = await fetch("/api/unmatch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                    body: JSON.stringify({ matchId }),
                  });
                  if (res.ok) router.replace("/app/profiles");
                  else setSendError((await res.json()).error ?? "Eroare");
                } finally {
                  setActionBusy(false);
                }
              }}
              className="text-sm text-dark-400 hover:text-red-400 transition disabled:opacity-50"
            >
              Anulează match
            </button>
          )}
          <button
            type="button"
            disabled={actionBusy}
            onClick={async () => {
              if (!confirm("Ștergi toată conversația? Mesajele vor dispărea pentru amândoi.")) return;
              setActionBusy(true);
              try {
                const res = await fetch("/api/conversations/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify({ conversationId: otherId }),
                });
                if (res.ok) router.replace("/app/profiles");
                else setSendError((await res.json()).error ?? "Eroare");
              } finally {
                setActionBusy(false);
              }
            }}
            className="text-sm text-dark-400 hover:text-red-400 transition disabled:opacity-50"
          >
            Șterge conversația
          </button>
        </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-dark-500 text-sm">
            Niciun mesaj. Scrie ceva mai jos.
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.fromId === me?.id;
          const showReadReceipt = areFriends && isMe && m.readAt;
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  isMe
                    ? "bg-brand-500 text-dark-900"
                    : "bg-dark-700 text-gray-200"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {m.text}
                </p>
                {showReadReceipt && (
                  <p className="text-xs mt-1 flex justify-end items-center gap-1 text-dark-700" title={`Citit ${new Date(m.readAt!).toLocaleString("ro-RO")}`}>
                    <CheckCheck className="w-3.5 h-3.5 text-[#4DABF7]" />
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex flex-col gap-2 pt-4">
        {sendError && (
          <p className="text-red-400 text-sm" role="alert">
            {sendError}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSendError(null);
            }}
            placeholder="Scrie un mesaj..."
            className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="p-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 disabled:opacity-50 transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
