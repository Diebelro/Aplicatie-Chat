"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, PhoneMissed } from "lucide-react";
import type { User } from "@/lib/store";
import type { Message } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";

type OtherWithMeta = User & { online?: boolean; distanceKm?: number; lastActivityAt?: number };

type ConversationItem = {
  otherUser: OtherWithMeta;
  lastMessage: Message;
  receivedCount: number;
  unreadCount: number;
  noMessagesYet?: boolean;
};

type FriendWithMeta = User & { online?: boolean; lastActivityAt?: number };

function formatDistance(km: number | undefined): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Ieri";
  }
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

function formatLastActive(ts: number | undefined): string {
  if (!ts) return "";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "online";
  if (min === 1) return "acum 1 min";
  if (min < 60) return `acum ${min} min`;
  const h = Math.floor(min / 60);
  if (h === 1) return "acum 1 oră";
  return `acum ${h} ore`;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [friends, setFriends] = useState<FriendWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw
    ? (() => {
        try {
          return JSON.parse(meRaw);
        } catch {
          return null;
        }
      })()
    : null;

  const fetchConversations = () => {
    fetch("/api/conversations", { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.conversations) setConversations(data.conversations);
      });
  };

  const fetchFriends = () => {
    fetch("/api/friends/list", { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => { if (data.friends) setFriends(data.friends); });
  };

  useEffect(() => {
    (async () => {
      const [convRes, friendsRes] = await Promise.all([
        fetch("/api/conversations", { headers: getAuthHeaders() }),
        fetch("/api/friends/list", { headers: getAuthHeaders() }),
      ]);
      const convData = await convRes.json();
      const friendsData = await friendsRes.json();
      if (convRes.ok) setConversations(convData.conversations || []);
      if (friendsRes.ok) setFriends(friendsData.friends || []);
      setLoading(false);
    })();
  }, []);

  // Polling listă conversații + prieteni la ~2s (ca WhatsApp)
  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => {
      fetchConversations();
      fetchFriends();
    }, 2000);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    const onFocus = () => {
      fetchConversations();
      fetchFriends();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const onConversationRead = () => {
      fetchConversations();
      fetchFriends();
    };
    window.addEventListener("align:conversation-read", onConversationRead);
    return () => window.removeEventListener("align:conversation-read", onConversationRead);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă mesajele...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold">Mesaje</h2>
        <Link
          href="/app/missed-calls"
          className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 hover:underline touch-manipulation"
        >
          <PhoneMissed className="w-4 h-4 shrink-0" />
          Apeluri pierdute
        </Link>
      </div>
      <p className="text-dark-500 text-sm mb-4">
        Toate conversațiile tale – apasă pe rând pentru chat. Lângă fiecare conversație:{" "}
        <span className="text-dark-400">Video</span> și <span className="text-dark-400">Audio</span> pentru apel direct.
      </p>

      {friends.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-dark-400 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#4DA6FF]" />
            Prieteni
          </h3>
          <ul className="flex flex-wrap gap-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-stretch gap-0 rounded-xl border border-dark-600 bg-dark-800 hover:border-[#4DA6FF]/50 transition overflow-hidden">
                <Link
                  href={`/app/chat/${f.id}`}
                  className="flex flex-1 items-center gap-2 px-3 py-2 min-w-0 touch-manipulation"
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#4DA6FF]/20 shrink-0">
                    <SilhouetteAvatar
                      photoUrl={f.photos?.[0]}
                      gender={f.gender}
                      name={f.name}
                      className="w-full h-full text-[#4DA6FF]"
                      imgClassName="w-full h-full object-cover"
                    />
                    {f.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-dark-800" />
                    )}
                  </div>
                  <span className="font-medium text-white text-sm truncate max-w-[100px]">{f.username ?? f.name}</span>
                  <span className="text-xs text-dark-500 shrink-0 max-sm:hidden">
                    {f.online ? "Online" : formatLastActive(f.lastActivityAt)}
                  </span>
                </Link>
                <div className="flex items-center pr-1.5 border-l border-dark-600 bg-dark-800">
                  <QuickCallButtons toUserId={f.id} size="sm" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-8 text-center">
          <p className="text-dark-500">Nu ai încă conversații.</p>
          <p className="text-dark-500 text-sm mt-2">
            Mergi la <Link href="/app/profiles" className="text-brand-400 hover:underline">Toate profilurile</Link> sau la{" "}
            <Link href="/app/matches" className="text-brand-400 hover:underline">Matches</Link> și trimite un mesaj.
          </p>
          <p className="text-dark-500 text-sm mt-4">
            Pentru <strong>apel 1-la-1</strong>, folosește butoanele Video / Audio lângă fiecare conversație (când ai mesaje), sau din{" "}
            <Link href="/app" className="text-brand-400 hover:underline">Descoperă</Link>,{" "}
            <Link href="/app/matches" className="text-brand-400 hover:underline">Matches</Link>,{" "}
            <Link href="/app/profiles" className="text-brand-400 hover:underline">Profiluri</Link> — și în <strong>chat</strong> (sus, Apel: Video | Audio).
          </p>
          <Link
            href="/app/call/start"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 border border-brand-500/40 transition font-medium"
          >
            Apel în conferință (3+ persoane)
          </Link>
        </div>
      ) : (
        <ul className="space-y-1">
          {conversations.map(({ otherUser, lastMessage, receivedCount, unreadCount, noMessagesYet }) => {
            const isFromMe =
              me?.id != null && String(lastMessage.fromId) === String(me.id);
            const preview = noMessagesYet
              ? "Trimite un mesaj"
              : (isFromMe ? "Tu: " : "") + (lastMessage.text.length > 50 ? lastMessage.text.slice(0, 50) + "…" : lastMessage.text);
            return (
              <li
                key={otherUser.id}
                className="flex items-stretch rounded-xl bg-dark-800 border border-dark-600 hover:border-dark-500 active:bg-dark-700/80 transition overflow-hidden touch-manipulation"
              >
                <Link
                  href={`/app/chat/${otherUser.id}`}
                  className="flex flex-1 items-center gap-3 sm:gap-4 min-h-[56px] p-3 sm:p-4 min-w-0"
                >
                  <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-brand-500/20">
                    <SilhouetteAvatar
                      photoUrl={otherUser.photos?.[0]}
                      gender={otherUser.gender}
                      name={otherUser.name}
                      className="w-full h-full text-brand-400"
                      imgClassName="w-full h-full object-cover"
                    />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-500 text-dark-900 text-xs font-semibold flex items-center justify-center"
                        title={`${unreadCount} necitite`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{displayName(otherUser.username ?? otherUser.name)}</span>
                      {otherUser.online && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-green-400" title="Online" />
                      )}
                    </div>
                    <p className="text-sm text-dark-500 truncate mt-0.5">{preview}</p>
                    <p className="text-xs text-dark-400 mt-1 flex flex-wrap gap-x-1 gap-y-0 items-center">
                      {unreadCount > 0 && (
                        <span className="text-brand-400">
                          {unreadCount} {unreadCount === 1 ? "necitit" : "necitite"}
                        </span>
                      )}
                      {unreadCount > 0 && (receivedCount > 0 || otherUser.distanceKm != null || otherUser.online != null) && <span>·</span>}
                      {receivedCount > 0 && (
                        <span>
                          {receivedCount} {receivedCount === 1 ? "mesaj primit" : "mesaje primite"}
                        </span>
                      )}
                      {(receivedCount > 0 || unreadCount > 0) && (otherUser.distanceKm != null || otherUser.online != null) && <span>·</span>}
                      {otherUser.distanceKm != null && <span>{formatDistance(otherUser.distanceKm)}</span>}
                      {otherUser.distanceKm != null && otherUser.online != null && <span>·</span>}
                      {otherUser.online != null && (
                        <span>{otherUser.online ? "Online" : "Offline"}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-dark-500 shrink-0 self-start pt-1 sm:self-center sm:pt-0">
                    {formatTime(lastMessage.at)}
                  </span>
                </Link>
                <div className="flex items-center pr-1 sm:pr-2 pl-0 border-l border-dark-600 bg-dark-800 shrink-0">
                  <QuickCallButtons toUserId={otherUser.id} size="sm" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
