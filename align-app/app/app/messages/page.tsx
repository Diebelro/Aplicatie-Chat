"use client";

import { useCallback, useEffect, useMemo, useState, type Ref } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isPageActive } from "@/lib/pageActive";
import { VPS_MESSAGES_LIST_POLL_MS } from "@/lib/vpsRealtimeConstants";
import { Users, PhoneMissed, MessageCircle } from "lucide-react";
import type { User } from "@/lib/store";
import type { Message } from "@/lib/store";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { displayName } from "@/lib/displayName";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { intlLocaleTag } from "@/lib/i18n/intlLocale";
import { AppProLoading } from "@/components/AppProLoading";
import { useMarkConversationReadWhenVisible } from "@/lib/useMarkConversationReadWhenVisible";

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

function MessagesConversationRow({
  item,
  formatTime,
  formatDistance: fmtKm,
  tStr,
  formatTpl,
  onMarkedRead,
}: {
  item: ConversationItem;
  formatTime: (iso: string) => string;
  formatDistance: (km: number | undefined) => string;
  tStr: (path: string) => string;
  formatTpl: (path: string, vars: Record<string, string | number>) => string;
  onMarkedRead: (otherId: string) => void;
}) {
  const { otherUser, lastMessage, receivedCount, unreadCount, noMessagesYet } = item;
  const rowRef = useMarkConversationReadWhenVisible(otherUser.id, unreadCount, () => onMarkedRead(otherUser.id));
  const isPlatformNotice = !!(lastMessage as Message & { isPlatformNotice?: boolean }).isPlatformNotice;
  const preview = noMessagesYet
    ? tStr("pages.messages.sendMessage")
    : isPlatformNotice
      ? tStr("pages.messages.platformNotice")
      : lastMessage.text.length > 50
        ? lastMessage.text.slice(0, 50) + "…"
        : lastMessage.text;
  const router = useRouter();
  const otherLabel = displayName(otherUser.username ?? otherUser.name);
  const chatPath = `/app/chat/${otherUser.id}`;
  const openChat = () => {
    router.push(chatPath);
  };

  return (
    <li
      ref={rowRef as Ref<HTMLLIElement>}
      className={`app-list-row hover:border-dark-500 active:bg-dark-700/80 ${unreadCount > 0 ? "app-list-row--unread" : ""}`}
    >
      <button
        type="button"
        onClick={openChat}
        aria-label={formatTpl(tStr("pages.messages.openChatAria"), { name: otherLabel })}
        className="app-list-row-btn"
      >
        <div className="app-avatar-wrap w-12 h-12">
          <div className="app-avatar-media">
            <SilhouetteAvatar
              photoUrl={otherUser.photos?.[0]}
              gender={otherUser.gender}
              name={otherUser.name}
              className="w-full h-full text-brand-400"
              imgClassName="w-full h-full object-cover"
            />
          </div>
          {unreadCount > 0 && (
            <span
              className="app-badge-count bg-brand-500 text-dark-900 shadow-sm"
              title={formatTpl(tStr("pages.messages.unreadTitle"), { n: unreadCount })}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-100 truncate">{otherLabel}</span>
            {otherUser.online && (
              <span className="shrink-0 w-2 h-2 rounded-full bg-green-400" title={tStr("pages.messages.online")} />
            )}
          </div>
          <p className={`text-sm truncate mt-0.5 ${unreadCount > 0 ? "text-zinc-200 font-medium" : "text-dark-500"}`}>{preview}</p>
          <p className="text-xs text-dark-400 mt-1 hidden sm:flex flex-wrap gap-x-1 gap-y-0 items-center">
            {unreadCount > 0 && (
              <span className="text-brand-400">
                {unreadCount}{" "}
                {unreadCount === 1 ? tStr("pages.messages.unreadOne") : tStr("pages.messages.unreadMany")}
              </span>
            )}
            {unreadCount > 0 && (receivedCount > 0 || otherUser.distanceKm != null || otherUser.online != null) && <span>·</span>}
            {receivedCount > 0 && (
              <span>
                {receivedCount}{" "}
                {receivedCount === 1 ? tStr("pages.messages.receivedOne") : tStr("pages.messages.receivedMany")}
              </span>
            )}
            {(receivedCount > 0 || unreadCount > 0) && (otherUser.distanceKm != null || otherUser.online != null) && <span>·</span>}
            {otherUser.distanceKm != null && <span>{fmtKm(otherUser.distanceKm)}</span>}
            {otherUser.distanceKm != null && otherUser.online != null && <span>·</span>}
            {otherUser.online != null && (
              <span>{otherUser.online ? tStr("pages.messages.online") : tStr("pages.messages.offline")}</span>
            )}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 self-center">
          <MessageCircle className="w-5 h-5 text-brand-400 shrink-0" aria-hidden />
          <span className="text-xs text-dark-500">{formatTime(lastMessage.at)}</span>
        </span>
      </button>
      <div className="flex items-center px-2 sm:px-2.5 border-l border-dark-600 bg-dark-800 shrink-0">
        <QuickCallButtons toUserId={otherUser.id} size="sm" />
      </div>
    </li>
  );
}

export default function MessagesPage() {
  const { locale, tStr } = useI18n();

  const formatTime = useCallback(
    (iso: string): string => {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const tag = intlLocaleTag(locale);
      if (sameDay) {
        return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return tStr("pages.messages.yesterday");
      }
      return d.toLocaleDateString(tag, { day: "numeric", month: "short" });
    },
    [locale, tStr]
  );

  const formatLastActive = useCallback(
    (ts: number | undefined): string => {
      if (!ts) return "";
      const min = Math.floor((Date.now() - ts) / 60000);
      if (min < 1) return tStr("pages.messages.lastOnline");
      if (min === 1) return tStr("pages.messages.lastMinOne");
      if (min < 60) return formatTpl(tStr("pages.messages.lastMinMany"), { n: min });
      const h = Math.floor(min / 60);
      if (h === 1) return tStr("pages.messages.lastHourOne");
      return formatTpl(tStr("pages.messages.lastHourMany"), { n: h });
    },
    [tStr]
  );

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [friends, setFriends] = useState<FriendWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = () => {
    fetchWithAuthRetry("/api/conversations", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {});
  };

  const fetchFriends = () => {
    fetchWithAuthRetry("/api/friends/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { if (data.friends) setFriends(data.friends); });
  };

  const handleConversationMarkedRead = useCallback((otherId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.otherUser.id === otherId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  useEffect(() => {
    (async () => {
      const [convRes, friendsRes] = await Promise.all([
        fetchWithAuthRetry("/api/conversations", { cache: "no-store" }),
        fetchWithAuthRetry("/api/friends/list", { cache: "no-store" }),
      ]);
      const convData = await convRes.json();
      const friendsData = await friendsRes.json();
      if (convRes.ok) setConversations(convData.conversations || []);
      if (friendsRes.ok) setFriends(friendsData.friends || []);
      setLoading(false);
    })();
  }, []);

  // Polling listă conversații + prieteni; pauză cât tab-ul nu e vizibil.
  useEffect(() => {
    if (loading) return;
    const POLL_MS = VPS_MESSAGES_LIST_POLL_MS;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const clearPoll = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const tick = () => {
      fetchConversations();
      fetchFriends();
    };
    const startPoll = () => {
      clearPoll();
      if (!isPageActive()) return;
      tick();
      intervalId = setInterval(tick, POLL_MS);
    };
    const onVisibility = () => {
      if (isPageActive()) startPoll();
      else clearPoll();
    };
    if (isPageActive()) startPoll();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", startPoll);
    window.addEventListener("focus", tick);
    return () => {
      clearPoll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", startPoll);
      window.removeEventListener("focus", tick);
    };
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

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const unreadDiff = (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0);
      if (unreadDiff !== 0) return unreadDiff;
      return new Date(b.lastMessage.at).getTime() - new Date(a.lastMessage.at).getTime();
    });
  }, [conversations]);

  if (loading) {
    return <AppProLoading variant="list" label={tStr("pages.messages.loading")} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1 sm:mb-3 shrink-0">
        <h2 className="text-lg sm:text-xl font-semibold text-zinc-100">{tStr("pages.messages.title")}</h2>
        <Link
          href="/app/missed-calls"
          className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 hover:underline touch-manipulation"
        >
          <PhoneMissed className="w-4 h-4 shrink-0" />
          {tStr("pages.messages.missedLink")}
        </Link>
      </div>
      <p className="app-pro-lead mb-2 max-sm:hidden sm:mb-4 text-sm sm:text-base leading-snug">
        {formatTpl(tStr("pages.messages.hint"), {
          video: tStr("pages.messages.video"),
          audio: tStr("pages.messages.audio"),
        })}
      </p>

      {friends.length > 0 && (
        <div className="mb-2 sm:mb-4 shrink-0 max-sm:overflow-x-auto max-sm:pb-1">
          <h3 className="text-sm font-medium text-dark-400 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#4DA6FF]" />
            {tStr("pages.messages.friends")}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {friends.map((f) => (
              <li key={f.id} className="app-list-row hover:border-[#4DA6FF]/50">
                <Link
                  href={`/app/chat/${f.id}`}
                  className="flex flex-1 items-center gap-2 px-3 py-2 min-h-[44px] min-w-0 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset rounded-xl"
                >
                  <span
                    className="flex shrink-0 items-center justify-center w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg bg-brand-500/15 text-brand-400 border border-brand-500/35"
                    aria-hidden
                  >
                    <MessageCircle className="w-4 h-4" />
                  </span>
                  <div className="app-avatar-wrap w-8 h-8">
                    <div className="app-avatar-media bg-[#4DA6FF]/20">
                      <SilhouetteAvatar
                        photoUrl={f.photos?.[0]}
                        gender={f.gender}
                        name={f.name}
                        className="w-full h-full text-[#4DA6FF]"
                        imgClassName="w-full h-full object-cover"
                      />
                    </div>
                    {f.online && (
                      <span className="absolute bottom-0 right-0 z-[2] w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-dark-800" />
                    )}
                  </div>
                  <span className="font-medium text-zinc-100 text-sm truncate max-w-[100px]">{f.username ?? f.name}</span>
                  <span className="text-xs text-dark-500 shrink-0 max-sm:hidden">
                    {f.online ? tStr("pages.messages.online") : formatLastActive(f.lastActivityAt)}
                  </span>
                </Link>
                <div className="flex items-center px-2.5 border-l border-dark-600 bg-dark-800">
                  <QuickCallButtons toUserId={f.id} size="sm" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="app-pro-empty min-h-0 flex-1 flex flex-col justify-center">
          <p className="text-dark-500 font-medium">{tStr("pages.messages.noConversations")}</p>
          <p className="app-pro-lead mt-3">
            {tStr("pages.messages.noConversationsHintBefore")}{" "}
            <Link href="/app/profiles" className="text-brand-400 hover:underline">
              {tStr("pages.messages.profilesLink")}
            </Link>{" "}
            {tStr("pages.messages.noConversationsHintOr")}{" "}
            <Link href="/app/matches" className="text-brand-400 hover:underline">
              {tStr("pages.messages.matchesLink")}
            </Link>{" "}
            {tStr("pages.messages.noConversationsHintAfter")}
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pb-2 sm:pb-3 scrollbar-app -mr-1 pr-1">
          {sortedConversations.map((item) => (
            <MessagesConversationRow
              key={item.otherUser.id}
              item={item}
              formatTime={formatTime}
              formatDistance={formatDistance}
              tStr={tStr}
              formatTpl={formatTpl}
              onMarkedRead={handleConversationMarkedRead}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
