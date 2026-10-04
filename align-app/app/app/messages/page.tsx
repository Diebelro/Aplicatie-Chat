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
  const profilePath = `/app/user/${otherUser.id}`;
  const openChat = () => {
    router.push(chatPath);
  };

  return (
    <li
      ref={rowRef as Ref<HTMLLIElement>}
      className={`app-list-row hover:border-dark-500 ${unreadCount > 0 ? "app-list-row--unread" : ""}`}
    >
      <Link
        href={profilePath}
        aria-label={formatTpl(tStr("pages.messages.viewProfileAria"), { name: otherLabel })}
        title={tStr("pages.messages.viewProfileTitle")}
        className="flex shrink-0 items-center self-stretch pl-3 pr-1 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset"
        onClick={(e) => e.stopPropagation()}
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
      </Link>
      <button
        type="button"
        onClick={openChat}
        aria-label={formatTpl(tStr("pages.messages.openChatAria"), { name: otherLabel })}
        className="app-list-row-btn !pl-1.5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-zinc-900 truncate">{otherLabel}</span>
            {otherUser.online && (
              <span className="shrink-0 w-2 h-2 rounded-full bg-green-400" title={tStr("pages.messages.online")} />
            )}
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-dark-500">
              {formatTime(lastMessage.at)}
            </span>
          </div>
          <p className={`text-sm truncate mt-0.5 ${unreadCount > 0 ? "text-zinc-800 font-medium" : "text-dark-500"}`}>
            {preview}
          </p>
          <p className="text-xs text-dark-400 mt-0.5 truncate">
            {[
              unreadCount > 0
                ? `${unreadCount} ${unreadCount === 1 ? tStr("pages.messages.unreadOne") : tStr("pages.messages.unreadMany")}`
                : null,
              receivedCount > 0
                ? `${receivedCount} ${receivedCount === 1 ? tStr("pages.messages.receivedOne") : tStr("pages.messages.receivedMany")}`
                : null,
              otherUser.distanceKm != null ? fmtKm(otherUser.distanceKm) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </button>
      <div className="flex items-center px-1.5 sm:px-2 border-l border-dark-600 bg-dark-800 shrink-0">
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

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [friends, setFriends] = useState<FriendWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const fetchConversations = () => {
    fetchWithAuthRetry("/api/conversations", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401) {
          setListError(tStr("pages.messages.errSession"));
          return;
        }
        if (res.ok && Array.isArray(data.conversations)) {
          setListError(null);
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
      if (convRes.ok) {
        setListError(null);
        setConversations(convData.conversations || []);
      } else if (convRes.status === 401) {
        setListError(tStr("pages.messages.errSession"));
      }
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

  useEffect(() => {
    const onPollSync = () => {
      fetchConversations();
      fetchFriends();
    };
    window.addEventListener("align:poll-sync", onPollSync);
    return () => window.removeEventListener("align:poll-sync", onPollSync);
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
        <h2 className="app-pro-page-title text-lg sm:text-xl">{tStr("pages.messages.title")}</h2>
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

      {listError && (
        <div
          className="mb-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          role="alert"
        >
          {listError}{" "}
          <Link href="/login" className="font-medium underline hover:text-red-300">
            {tStr("pages.messages.loginNowLink")}
          </Link>
        </div>
      )}

      {friends.length > 0 && (
        <div className="mb-2 sm:mb-3 shrink-0">
          <h3 className="text-sm font-medium text-dark-400 mb-1.5 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#4DA6FF]" />
            {tStr("pages.messages.friends")}
          </h3>
          <ul className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 -mx-0.5 px-0.5 scrollbar-app">
            {friends.map((f) => {
              const friendLabel = displayName(f.username ?? f.name);
              return (
                <li
                  key={f.id}
                  className="flex shrink-0 items-center gap-1 rounded-2xl border border-dark-600/80 bg-white px-2 py-1.5 shadow-sm"
                >
                  <Link
                    href={`/app/user/${f.id}`}
                    aria-label={formatTpl(tStr("pages.messages.viewProfileAria"), { name: friendLabel })}
                    title={tStr("pages.messages.viewProfileTitle")}
                    className="app-avatar-wrap w-9 h-9 touch-manipulation"
                  >
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
                  </Link>
                  <Link
                    href={`/app/chat/${f.id}`}
                    className="min-w-0 max-w-[5.5rem] touch-manipulation focus-visible:outline-none"
                    aria-label={formatTpl(tStr("pages.messages.openChatAria"), { name: friendLabel })}
                  >
                    <span className="block font-medium text-zinc-900 text-sm truncate">{friendLabel}</span>
                  </Link>
                  <Link
                    href={`/app/chat/${f.id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400 border border-brand-500/35 touch-manipulation"
                    aria-label={formatTpl(tStr("pages.messages.openChatAria"), { name: friendLabel })}
                    title={tStr("pages.messages.openChatButtonTitle")}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="app-pro-empty min-h-0 flex-1 flex flex-col justify-center">
          {listError ? (
            <p className="text-red-400 font-medium">{listError}</p>
          ) : (
            <>
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
            </>
          )}
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
