"use client";

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Video, Phone, Check, Loader2, Paperclip, X, FileText, MapPin, MoreHorizontal } from "lucide-react";
import type { Gender, User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";
import type { RingNotifySnapshot } from "@/lib/callRingNotifySnapshot";
import { RING_PUSH_HINT_DELAY_MS, getRingNotifyHintKey } from "@/lib/callRingNotifySnapshot";
import { track } from "@/lib/tracking";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders, fetchWithAuthRetry } from "@/lib/authClient";
import { clientHangupCall } from "@/lib/callHangupClient";
import { VPS_CHAT_MESSAGES_POLL_MS } from "@/lib/vpsRealtimeConstants";
import { messageAttachmentProxyPath, shouldProxyChatAttachment } from "@/lib/chatAttachmentProxy";
import {
  ALIGN_LOCATION_CONTENT_TYPE,
  formatLocationCoordsExact,
  formatLocationPrimaryLine,
  googleMapsUrl,
  isAlignLocationContentType,
  parseAlignLocationPayload,
  serializeAlignLocation,
} from "@/lib/chatLocation";
import { clearChatDraft, readChatDraft, writeChatDraft } from "@/lib/formDrafts";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import type { Locale } from "@/lib/i18n/types";
import { isAllowedAttachmentType, isVideoContentType } from "@/lib/chatAttachments";
import { AppProLoading } from "@/components/AppProLoading";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";

const ALLOWED_ATTACH_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime";
const MAX_ATTACH_MB = 25;

function intlTagForLocale(locale: Locale): string {
  if (locale === "en") return "en-US";
  if (locale === "de") return "de-DE";
  return "ro-RO";
}

function formatChatDistanceKm(distanceKm: number, locale: Locale, tStr: (path: string) => string): string {
  const tag = intlTagForLocale(locale);
  if (distanceKm < 1) {
    return formatTpl(tStr("pages.chat.distanceM"), { n: Math.round(distanceKm * 1000) });
  }
  const rounded = Math.round(distanceKm * 10) / 10;
  const n = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rounded);
  return formatTpl(tStr("pages.chat.distanceKm"), { n });
}

function withDevStatusPrefix(code: number, message: string): string {
  return [401, 402, 403, 500].includes(code) && process.env.NODE_ENV === "development" ? `[${code}] ${message}` : message;
}

interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string;
  readAt?: string;
  /** SENT / DELIVERED / SEEN (Prisma); pentru bifat trimis/primit/citit */
  status?: "SENT" | "DELIVERED" | "SEEN";
  /** ISO string când a fost citit (fallback pentru Citit) */
  seenAt?: string | null;
  attachmentUrl?: string | null;
  attachmentContentType?: string | null;
  /** Mesaj optimist: încă nu a răspuns serverul */
  clientPending?: boolean;
  /** Notificare moderare / reguli — afișată centrat, nu ca mesaj de la interlocutor */
  isPlatformNotice?: boolean;
}

function isImageType(ct: string | null | undefined): boolean {
  return ct === "image/jpeg" || ct === "image/png" || ct === "image/webp";
}

function isVideoType(ct: string | null | undefined): boolean {
  return isVideoContentType((ct || "").trim());
}

function locationBubbleParsed(m: Message): ReturnType<typeof parseAlignLocationPayload> {
  if (!isAlignLocationContentType(m.attachmentContentType)) return null;
  return parseAlignLocationPayload(m.attachmentUrl ?? null);
}

/** Culori soft pentru cardul de locație: albastru (ea → el), roz (el → ea), altfel nuanțe teal ca în brand. */
function locationShareBubblePalette(
  senderGender: Gender | undefined,
  recipientGender: Gender | undefined,
  isOnMyMessageBubble: boolean
): { box: string; muted: string; link: string; pin: string } {
  const femaleToMale = senderGender === "female" && recipientGender === "male";
  const maleToFemale = senderGender === "male" && recipientGender === "female";

  if (femaleToMale) {
    return isOnMyMessageBubble
      ? {
          box: "border-sky-400/55 bg-sky-100 text-sky-950",
          muted: "text-sky-900/75",
          link: "text-sky-800 underline font-medium",
          pin: "text-sky-700",
        }
      : {
          box: "border-sky-200 bg-sky-50 text-sky-950 shadow-sm",
          muted: "text-sky-800/85",
          link: "text-sky-700 underline font-medium",
          pin: "text-sky-600",
        };
  }
  if (maleToFemale) {
    return isOnMyMessageBubble
      ? {
          box: "border-rose-400/55 bg-rose-100 text-rose-950",
          muted: "text-rose-900/75",
          link: "text-rose-800 underline font-medium",
          pin: "text-rose-700",
        }
      : {
          box: "border-rose-200 bg-rose-50 text-rose-950 shadow-sm",
          muted: "text-rose-800/85",
          link: "text-rose-700 underline font-medium",
          pin: "text-rose-600",
        };
  }
  return isOnMyMessageBubble
    ? {
        box: "border-teal-400/50 bg-teal-100 text-teal-950",
        muted: "text-teal-900/75",
        link: "text-teal-800 underline font-medium",
        pin: "text-teal-800",
      }
    : {
        box: "border-teal-200 bg-emerald-50/90 text-teal-950 shadow-sm",
        muted: "text-teal-800/85",
        link: "text-brand-600 underline font-medium",
        pin: "text-teal-700",
      };
}

/** Fundal modal confirmare trimite locație (nu se poate stiliza `window.confirm`). */
function locationShareConfirmTheme(sender: Gender | undefined, recipient: Gender | undefined) {
  if (sender === "female" && recipient === "male") {
    return {
      panel: "bg-sky-100 border-sky-300/90 text-sky-950",
      sub: "text-sky-900/90",
      primary: "bg-sky-600 hover:bg-sky-500 text-white",
      secondary: "border-sky-400 bg-sky-50/80 text-sky-950 hover:bg-sky-200/90",
    };
  }
  if (sender === "male" && recipient === "female") {
    return {
      panel: "bg-rose-100 border-rose-300/90 text-rose-950",
      sub: "text-rose-900/90",
      primary: "bg-rose-600 hover:bg-rose-500 text-white",
      secondary: "border-rose-400 bg-rose-50/80 text-rose-950 hover:bg-rose-200/90",
    };
  }
  return {
    panel: "bg-teal-50 border-teal-300/80 text-teal-950",
    sub: "text-teal-900/90",
    primary: "bg-brand-600 hover:bg-brand-500 text-white",
    secondary: "border-teal-400 bg-white/70 text-teal-950 hover:bg-teal-100/90",
  };
}

/** Compară ID-uri user indiferent de tip (numeric vs string) sau spații. */
function sameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = a != null ? String(a).trim() : "";
  const y = b != null ? String(b).trim() : "";
  return x !== "" && y !== "" && x === y;
}

/** Dacă API-ul nu trimite încă currentUserId, deducem „cine sunt eu” din mesaje. */
function inferMyUserIdFromMessages(messages: Message[], otherUserId: string): string | null {
  for (const m of messages) {
    if (sameUserId(m.fromId, otherUserId) && m.toId) return String(m.toId).trim();
    if (sameUserId(m.toId, otherUserId) && m.fromId) return String(m.fromId).trim();
  }
  return null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const otherId = (params?.id as string) ?? "";
  const [other, setOther] = useState<(User & { online?: boolean; distanceKm?: number; lastActivityAt?: number }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [areFriends, setAreFriends] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isPaywallError, setIsPaywallError] = useState(false);
  const [calling, setCalling] = useState<"video" | "audio" | null>(null);
  /** Afișat după ring reușit dacă push către destinatar probabil lipsește. */
  const [ringPushHint, setRingPushHint] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [chatOverflowOpen, setChatOverflowOpen] = useState(false);
  const [blockedUsersList, setBlockedUsersList] = useState<{ id: string; username: string | null; profileName: string | null }[]>(
    []
  );
  const [blockedListLoading, setBlockedListLoading] = useState(false);
  const [conversationBlocked, setConversationBlocked] = useState(false);
  const [chatInfoMessage, setChatInfoMessage] = useState<string | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    url: string;
    contentType: string;
    /** Preview local pentru imagini cât timp blob-ul e private (înainte de mesaj salvat). */
    previewUrl?: string;
  } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadConfigured, setUploadConfigured] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  /** Fallback când lipsește align_user în storage dar sesiunea (cookie) e validă — ca butoanele Apel să apară. */
  const [meIdFromMeApi, setMeIdFromMeApi] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [locationShareConfirmOpen, setLocationShareConfirmOpen] = useState(false);
  const locationSharePendingRef = useRef<{ backupText: string; fromId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  /** Doar zona listei de mesaje — evită scrollIntoView care poate derula tot viewport-ul și ascunde câmpul de scris. */
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const prevCallerIdRef = useRef<string | null>(null);
  /** După încărcare conversație: câteva sute de ms ținem lista lipită de jos când crește înălțimea (imagini, font). */
  const pinListToBottomUntilRef = useRef(0);
  const otherPollTickRef = useRef(0);
  const prevMessageCountRef = useRef(0);
  const chatTextRef = useRef("");
  const chatOtherIdRef = useRef("");
  /** false când pagina de chat s-a demontat — oprește navigarea spre /app/call după ring. */
  const chatPageLiveRef = useRef(true);
  /** Schimbare conversație: anulăm „ring în zbor” pentru vechiul otherId. */
  const ringSessionOtherIdRef = useRef(otherId);

  const { tStr, locale } = useI18n();

  useLayoutEffect(() => {
    ringSessionOtherIdRef.current = otherId;
  }, [otherId]);

  useEffect(() => {
    chatPageLiveRef.current = true;
    return () => {
      chatPageLiveRef.current = false;
    };
  }, []);

  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw ? (() => { try { return JSON.parse(meRaw); } catch { return null; } })() : null;
  /** Sursă adevăr: server (mesaje) > /api/me > storage — ca apelul și bifele să nu depindă de JSON stricat în localStorage. */
  const inferredFromMessages = inferMyUserIdFromMessages(messages, otherId);
  const myIdForTicks =
    currentUserId != null
      ? String(currentUserId)
      : meIdFromMeApi != null
        ? String(meIdFromMeApi)
        : me?.id != null
          ? String(me.id)
          : inferredFromMessages != null
            ? inferredFromMessages
            : "";
  const callerId = (myIdForTicks || "").trim() || null;

  useEffect(() => {
    let cancelled = false;
    fetchWithAuthRetry("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.user?.id) return;
        setMeIdFromMeApi(String(d.user.id));
        if (typeof window !== "undefined" && d.user) {
          try {
            const fromLocal = !!localStorage.getItem("align_user");
            (fromLocal ? localStorage : sessionStorage).setItem("align_user", JSON.stringify(d.user));
            window.dispatchEvent(new CustomEvent("align_user_updated", { detail: d.user }));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchOther = async () => {
    const res = await fetchWithAuthRetry(`/api/users/${otherId}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok && data.user) setOther(data.user);
  };

  const fetchMessages = useCallback(
    async (opts?: { markConversationRead?: boolean }) => {
      const markRead = opts?.markConversationRead !== false;
      const q = markRead ? "" : "&markRead=0";
      const res = await fetchWithAuthRetry(
        `/api/messages?with=${encodeURIComponent(otherId)}&_=${Date.now()}${q}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setConversationBlocked(!!(data as { conversationBlocked?: boolean }).conversationBlocked);
        const incoming = (data.messages || []) as Message[];
        setMessages((prev) => {
          const pending = prev.filter(
            (m) =>
              m.clientPending &&
              String(m.toId) === String(otherId) &&
              !incoming.some((s) => s.id === m.id)
          );
          const filteredPending = pending.filter((p) => {
            const dup = incoming.some((s) => {
              if (String(s.fromId) !== String(p.fromId)) return false;
              if (Math.abs(new Date(s.at).getTime() - new Date(p.at).getTime()) >= 120_000) return false;
              if (p.attachmentUrl && s.attachmentUrl && p.attachmentUrl === s.attachmentUrl) return true;
              return s.text === p.text;
            });
            return !dup;
          });
          return [...incoming, ...filteredPending].sort(
            (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
          );
        });
        setAreFriends(!!data.areFriends);
        setMatchId(data.matchId ?? null);
        if (data.currentUserId != null) setCurrentUserId(data.currentUserId);
        setFetchError(null);
        if (markRead && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("align:conversation-read", { detail: { otherId } }));
        }
      } else if ([401, 402, 403, 500].includes(res.status)) {
        const code = res.status;
        const raw = String((data?.error as string) ?? "").trim();
        const localized =
          (raw ? translateApiErrorMessage(raw, tStr) : "") || (raw || tStr("pages.chat.fetchErrGeneric"));
        setFetchError(withDevStatusPrefix(code, localized));
      }
    },
    [otherId, tStr]
  );

  const loadBlockedList = useCallback(async () => {
    setBlockedListLoading(true);
    try {
      const r = await fetchWithAuthRetry("/api/blocks", { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { blocked?: { id: string; username: string | null; profileName: string | null }[] };
      if (r.ok && Array.isArray(d.blocked)) {
        setBlockedUsersList(d.blocked);
      }
    } finally {
      setBlockedListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!chatOverflowOpen) return;
    void loadBlockedList();
  }, [chatOverflowOpen, loadBlockedList]);

  useEffect(() => {
    if (!chatOverflowOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = overflowMenuRef.current;
      if (el && !el.contains(e.target as Node)) setChatOverflowOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [chatOverflowOpen]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
    otherPollTickRef.current = 0;
    prevMessageCountRef.current = 0;
    pinListToBottomUntilRef.current = 0;
    setConversationBlocked(false);
    setChatOverflowOpen(false);
    setChatInfoMessage(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [otherId]);

  useEffect(() => {
    prevCallerIdRef.current = null;
  }, [otherId]);

  /** Fără restaurarea automată a scroll-ului din istoric — alfel conversația se deschide „pe la mijloc”. */
  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  chatTextRef.current = text;
  chatOtherIdRef.current = otherId;

  /** Ciornă mesaj: sessionStorage pe tab, per conversație (nu parolă / nu alt tab). */
  useLayoutEffect(() => {
    const saved = readChatDraft(otherId);
    setText(saved);
  }, [otherId]);

  useEffect(() => {
    const convId = otherId;
    const t = window.setTimeout(() => {
      if (chatOtherIdRef.current !== convId) return;
      writeChatDraft(convId, chatTextRef.current);
    }, 450);
    return () => clearTimeout(t);
  }, [text, otherId]);

  /** Deschidere chat: mesaje + header în paralel; nu așteptăm visit/upload ca să nu pară „blocat”. */
  useEffect(() => {
    if (!otherId) return;
    setFetchError(null);
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        await fetchWithAuthRetry("/api/me/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otherId }),
        }).catch(() => null);
        await Promise.all([fetchOther(), fetchMessages({ markConversationRead: true })]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    fetchWithAuthRetry("/api/chat/upload", { method: "GET", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.configured === "boolean") setUploadConfigured(d.configured);
      })
      .catch(() => {
        /* Nu ascunde butonul la rețea eronată — utilizatorul poate reîncerca upload la nevoie. */
      });
    fetchWithAuthRetry("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: otherId }),
    })
      .then(() => track.view_profile(otherId))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [otherId, fetchMessages]);

  /** Poll: fără markRead pe fiecare tick. Pauză cât tab-ul nu e vizibil. */
  const POLL_MS = VPS_CHAT_MESSAGES_POLL_MS;
  useEffect(() => {
    if (!otherId || loading) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const clearPoll = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const tick = () => {
      void fetchMessages({ markConversationRead: false });
      otherPollTickRef.current += 1;
      if (otherPollTickRef.current % 3 === 0) void fetchOther();
    };
    const startPoll = () => {
      clearPoll();
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      intervalId = setInterval(tick, POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        startPoll();
      } else {
        clearPoll();
      }
    };
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      tick();
      startPoll();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearPoll();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [otherId, loading, fetchMessages]);

  useEffect(() => {
    if (!otherId || loading) return;
    const markReadNow = () => {
      void fetchWithAuthRetry("/api/me/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherId }),
      })
        .then((r) => {
          if (r?.ok && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("align:conversation-read", { detail: { otherId } }));
          }
        })
        .catch(() => {});
      void fetchMessages({ markConversationRead: true });
    };
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      markReadNow();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      markReadNow();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [otherId, loading, fetchMessages]);

  /** Mobil / tab-uri: retrimite „citit” periodic ca destinatarul (ex. pe telefon) să primească bifa fără să depindă de un singur poll. */
  useEffect(() => {
    if (!otherId || loading) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void fetchWithAuthRetry("/api/me/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherId }),
      }).catch(() => {});
    }, 12_000);
    return () => clearInterval(id);
  }, [otherId, loading]);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const top = el.scrollHeight - el.clientHeight;
    el.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  /** După ce se termină încărcarea conversației: întoarcem pagina sus + scroll jos în panoul de mesaje (repetat pentru layout mobil / imagini). Nu depinde de `messages` ca să nu resetăm la fiecare poll. */
  useEffect(() => {
    if (loading) return;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    pinListToBottomUntilRef.current = Date.now() + 4500;
    if (messages.length === 0) return;

    const run = () => scrollMessagesToBottom("auto");
    run();
    const timeouts = [40, 120, 300, 700, 1200, 2200, 3500].map((ms) => setTimeout(run, ms));
    const raf1 = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    return () => {
      timeouts.forEach(clearTimeout);
      cancelAnimationFrame(raf1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doar la schimbare conversație / sfârșit încărcare
  }, [loading, otherId, scrollMessagesToBottom]);

  useEffect(() => {
    if (loading) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (Date.now() > pinListToBottomUntilRef.current) return;
      scrollMessagesToBottom("auto");
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, otherId, scrollMessagesToBottom]);

  /**
   * Când îți vine `callerId` după primul paint (ex. doar din /api/me), trebuie scroll la ultimul mesaj;
   * altfel rămâi „sus” în listă și mesajele tale par invizibile (bulă greșită pe tema light).
   */
  useEffect(() => {
    if (loading || messages.length === 0 || !callerId) return;
    const prev = prevCallerIdRef.current;
    prevCallerIdRef.current = callerId;
    if (prev === callerId) return;
    pinListToBottomUntilRef.current = Math.max(pinListToBottomUntilRef.current, Date.now() + 2500);
    const run = () => scrollMessagesToBottom("auto");
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, [callerId, loading, messages.length, scrollMessagesToBottom]);

  /**
   * Deschidere: scroll instant în panoul mesaje.
   * După: la mesaj trimis de tine → smooth. La mesaj primit: dacă erai deja lipit de jos (ca în WhatsApp),
   * derulăm instant ca să nu rămână sub bara de scris; dacă ai urcat în istoric, nu te tragem în jos.
   */
  useLayoutEffect(() => {
    if (loading || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const lastIsMine =
      callerId != null && last != null && sameUserId(last.fromId, callerId);
    const grew = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (!initialScrollDoneRef.current) {
      scrollMessagesToBottom("auto");
      requestAnimationFrame(() => {
        scrollMessagesToBottom("auto");
        requestAnimationFrame(() => {
          scrollMessagesToBottom("auto");
          initialScrollDoneRef.current = true;
        });
      });
      return;
    }

    if (!grew) return;

    const el = messagesScrollRef.current;
    const distanceFromBottom =
      el != null ? el.scrollHeight - el.scrollTop - el.clientHeight : Number.POSITIVE_INFINITY;
    /** Sub această distanță față de fund = lipit de jos (inclusiv după un mesaj înalt cu imagine). */
    const NEAR_BOTTOM_PX = 420;

    const shouldStickToIncoming =
      !lastIsMine && !last?.clientPending && distanceFromBottom < NEAR_BOTTOM_PX;

    if (last?.clientPending || lastIsMine) {
      scrollMessagesToBottom("smooth");
      return;
    }

    if (shouldStickToIncoming) {
      scrollMessagesToBottom("auto");
      pinListToBottomUntilRef.current = Math.max(pinListToBottomUntilRef.current, Date.now() + 2400);
      requestAnimationFrame(() => {
        scrollMessagesToBottom("auto");
        requestAnimationFrame(() => scrollMessagesToBottom("auto"));
      });
    }
  }, [messages, loading, callerId, scrollMessagesToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conversationBlocked) return;
    const hasText = text.trim().length > 0;
    const hasAttach = !!pendingAttachment;
    if ((!hasText && !hasAttach) || sending || sendingLocation) return;

    const backupText = text.trim();
    const backupAttach = pendingAttachment;
    const fromIdOptimistic =
      (callerId || meIdFromMeApi || inferredFromMessages || "").trim();
    if (!fromIdOptimistic) {
      setSendError(tStr("pages.chat.accountLoadingRetry"));
      return;
    }

    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimistic: Message = {
      id: optimisticId,
      fromId: fromIdOptimistic,
      toId: otherId,
      text: backupText,
      at: new Date().toISOString(),
      status: "SENT",
      seenAt: null,
      attachmentUrl:
        backupAttach && isImageType(backupAttach.contentType) && backupAttach.previewUrl
          ? backupAttach.previewUrl
          : backupAttach?.url ?? null,
      attachmentContentType: backupAttach?.contentType ?? null,
      clientPending: true,
    };

    setSending(true);
    setSendError(null);
    setIsPaywallError(false);
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });

    try {
      const headers = getAuthHeaders() as Record<string, string>;
      if (!headers["x-user-id"]) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setText(backupText);
        setPendingAttachment(backupAttach);
        setSendError(tStr("pages.chat.notAuthenticated"));
        return;
      }
      const body: { toId: string; text: string; attachmentUrl?: string; attachmentContentType?: string } = {
        toId: otherId,
        text: backupText,
      };
      if (backupAttach) {
        body.attachmentUrl = backupAttach.url;
        body.attachmentContentType = backupAttach.contentType;
      }
      const res = await fetchWithAuthRetry("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        const msg = { ...(data.message as Message), clientPending: false };
        if (shouldProxyChatAttachment(msg.attachmentUrl, msg.attachmentContentType)) {
          msg.attachmentUrl = messageAttachmentProxyPath(msg.id);
        }
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? msg : m)));
        clearChatDraft(otherId);
        /** Răspunsul POST conține deja mesajul — fără al doilea GET (mai puțină latență percepută). */
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setText(backupText);
        setPendingAttachment(backupAttach);
        const paywall =
          res.status === 402 ||
          (res.status === 403 &&
            (String(data.error ?? "").includes("abonament") || String(data.error ?? "").toLowerCase().includes("subscription")));
        setIsPaywallError(!!paywall);
        const code = res.status;
        const rawErr = String(data.error ?? "").trim();
        const localized =
          translateApiErrorMessage(rawErr, tStr) || (rawErr || tStr("pages.chat.sendFailed"));
        setSendError(withDevStatusPrefix(code, localized));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(backupText);
      setPendingAttachment(backupAttach);
      setIsPaywallError(false);
      setSendError(tStr("pages.chat.networkErrorMessage"));
    } finally {
      setSending(false);
      queueMicrotask(() => textInputRef.current?.focus());
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACH_MB * 1024 * 1024) {
      setIsPaywallError(false);
      setSendError(formatTpl(tStr("pages.chat.fileTooBig"), { mb: MAX_ATTACH_MB }));
      return;
    }
    if (!isAllowedAttachmentType(file.type)) {
      setIsPaywallError(false);
      setSendError(tStr("pages.chat.fileTypeNotAllowed"));
      return;
    }
    setUploadingAttachment(true);
    setSendError(null);
    setIsPaywallError(false);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetchWithAuthRetry("/api/chat/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url && data.contentType) {
        const previewUrl =
          file.type.startsWith("image/") || file.type.startsWith("video/")
            ? URL.createObjectURL(file)
            : undefined;
        setPendingAttachment((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return { url: data.url as string, contentType: data.contentType as string, previewUrl };
        });
      } else {
        setIsPaywallError(false);
        const rawMsg = String(data?.error ?? "").trim();
        const isBlob503 =
          res.status === 503 &&
          (/blob/i.test(rawMsg) || /configurat|configured/i.test(rawMsg));
        const friendly = isBlob503
          ? tStr("pages.chat.attachmentsUnavailable")
          : translateApiErrorMessage(rawMsg, tStr) || rawMsg || tStr("pages.chat.uploadFailed");
        setSendError(friendly);
        if (res.status === 503) setUploadConfigured(false);
      }
    } catch {
      setIsPaywallError(false);
      setSendError(tStr("pages.chat.uploadFailed"));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const runShareLocationWithGeolocation = (backupText: string, fromIdOptimistic: string) => {
    setSendingLocation(true);
    setSendError(null);
    setIsPaywallError(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const payload = serializeAlignLocation(lat, lng);
        const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const optimistic: Message = {
          id: optimisticId,
          fromId: fromIdOptimistic,
          toId: otherId,
          text: backupText,
          at: new Date().toISOString(),
          status: "SENT",
          seenAt: null,
          attachmentUrl: payload,
          attachmentContentType: ALIGN_LOCATION_CONTENT_TYPE,
          clientPending: true,
        };
        setMessages((prev) => [...prev, optimistic]);
        setText("");
        clearChatDraft(otherId);

        try {
          const headers = getAuthHeaders() as Record<string, string>;
          if (!headers["x-user-id"]) {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setText(backupText);
            setSendError(tStr("pages.chat.notAuthenticated"));
            return;
          }
          const res = await fetchWithAuthRetry("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toId: otherId,
              text: backupText,
              latitude: lat,
              longitude: lng,
            }),
          });
          const data = await res.json();
          if (res.ok && data.message) {
            const msg = { ...(data.message as Message), clientPending: false };
            if (shouldProxyChatAttachment(msg.attachmentUrl, msg.attachmentContentType)) {
              msg.attachmentUrl = messageAttachmentProxyPath(msg.id);
            }
            setMessages((prev) => prev.map((m) => (m.id === optimisticId ? msg : m)));
            clearChatDraft(otherId);
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setText(backupText);
            const paywall =
              res.status === 402 ||
              (res.status === 403 &&
                (String(data.error ?? "").includes("abonament") ||
                  String(data.error ?? "").toLowerCase().includes("subscription")));
            setIsPaywallError(!!paywall);
            const code = res.status;
            const rawErr = String(data.error ?? "").trim();
            const localized =
              translateApiErrorMessage(rawErr, tStr) || (rawErr || tStr("pages.chat.sendFailed"));
            setSendError(withDevStatusPrefix(code, localized));
          }
        } catch {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setText(backupText);
          setIsPaywallError(false);
          setSendError(tStr("pages.chat.networkErrorLocation"));
        } finally {
          setSendingLocation(false);
          queueMicrotask(() => textInputRef.current?.focus());
        }
      },
      () => {
        setSendingLocation(false);
        setIsPaywallError(false);
        setSendError(tStr("pages.chat.geoPermission"));
        queueMicrotask(() => textInputRef.current?.focus());
      },
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 22_000 }
    );
  };

  const shareCurrentLocation = () => {
    if (conversationBlocked) return;
    if (sending || sendingLocation || uploadingAttachment) return;
    if (pendingAttachment) {
      setIsPaywallError(false);
      setSendError(tStr("pages.chat.removeAttachmentFirst"));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setIsPaywallError(false);
      setSendError(tStr("pages.chat.noGeoBrowser"));
      return;
    }
    const backupText = text.trim();
    const fromIdOptimistic =
      (callerId || meIdFromMeApi || inferredFromMessages || "").trim();
    if (!fromIdOptimistic) {
      setSendError(tStr("pages.chat.accountLoadingRetry"));
      return;
    }
    locationSharePendingRef.current = { backupText, fromId: fromIdOptimistic };
    setLocationShareConfirmOpen(true);
  };

  const confirmLocationShare = () => {
    const p = locationSharePendingRef.current;
    setLocationShareConfirmOpen(false);
    locationSharePendingRef.current = null;
    if (!p) return;
    runShareLocationWithGeolocation(p.backupText, p.fromId);
  };

  const cancelLocationShare = () => {
    setLocationShareConfirmOpen(false);
    locationSharePendingRef.current = null;
  };

  useEffect(() => {
    if (!locationShareConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLocationShareConfirmOpen(false);
        locationSharePendingRef.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locationShareConfirmOpen]);

  const ringAndGoCall = useCallback(
    async (audioOnly: boolean) => {
      if (!callerId) return;
      if (conversationBlocked) return;
      const sessionOtherId = otherId;
      const roomIdForRing = getVideoRoomId(callerId, sessionOtherId);
      const stillThisChat = () =>
        chatPageLiveRef.current && ringSessionOtherIdRef.current === sessionOtherId;

      const retractRingIfAbandoned = () => {
        void clientHangupCall({ roomId: roomIdForRing });
      };

      setSendError(null);
      setRingPushHint(null);
      setCalling(audioOnly ? "audio" : "video");
      try {
        const res = await fetchWithAuthRetry("/api/call/ring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toId: sessionOtherId, audioOnly }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          const raw = String(j.error ?? "").trim();
          setSendError(translateApiErrorMessage(raw, tStr) || raw || tStr("pages.chat.errGeneric"));
          return;
        }
        if (!stillThisChat()) {
          retractRingIfAbandoned();
          return;
        }
        const j = (await res.json().catch(() => ({}))) as { notify?: RingNotifySnapshot };
        const hintKey = getRingNotifyHintKey(j.notify);
        if (hintKey) {
          setRingPushHint(tStr(`pages.callRoom.ringPushHint.${hintKey}`));
          await new Promise((r) => setTimeout(r, RING_PUSH_HINT_DELAY_MS));
        }
        if (!stillThisChat()) {
          retractRingIfAbandoned();
          return;
        }
        const qs = audioOnly ? "?audio=1&from=ring" : "?from=ring";
        router.push(`/app/call/${roomIdForRing}${qs}`);
      } catch {
        setSendError(tStr("pages.chat.fetchErrGeneric"));
      } finally {
        setCalling(null);
      }
    },
    [callerId, otherId, router, tStr, conversationBlocked]
  );

  if (loading) {
    return <AppProLoading variant="chat" label={tStr("pages.chat.loading")} />;
  }

  if (!other && !me) {
    return (
      <div className="max-w-md mx-auto app-pro-empty">
        <p className="app-pro-lead mb-4">{tStr("pages.chat.profileNotFound")}</p>
        <Link href="/app/profiles" className="text-brand-400 hover:underline">
          {tStr("pages.chat.backToProfiles")}
        </Link>
      </div>
    );
  }

  const otherUser = other || (me?.id === otherId ? me : null);
  const displayNameStr = otherUser ? displayName(otherUser.username ?? otherUser.name) : tStr("pages.chat.profileFallback");
  const distanceStr =
    other && typeof other.distanceKm === "number" ? formatChatDistanceKm(other.distanceKm, locale, tStr) : null;

  const locShareDialogTheme = locationShareConfirmTheme(me?.gender, other?.gender);

  const blockedRowLabel = (row: { id: string; username: string | null; profileName: string | null }) => {
    const raw = (row.username?.trim() || row.profileName?.trim() || "").trim();
    if (!raw) return tStr("pages.chat.profileFallback");
    return displayName(raw);
  };
  const iHaveBlockedOther = blockedUsersList.some((b) => b.id === otherId);
  const composerLocked = conversationBlocked;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full">
      {locationShareConfirmOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelLocationShare();
          }}
        >
          <div
            className={`max-w-md w-full rounded-2xl border-2 shadow-2xl p-5 sm:p-6 ${locShareDialogTheme.panel}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loc-share-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="loc-share-confirm-title" className="text-lg font-semibold mb-2">
              {tStr("pages.chat.locShareTitle")}
            </h2>
            <p className={`text-sm leading-relaxed ${locShareDialogTheme.sub}`}>
              {tStr("pages.chat.locShareBody")}
            </p>
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button
                type="button"
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${locShareDialogTheme.secondary}`}
                onClick={cancelLocationShare}
              >
                {tStr("pages.chat.cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${locShareDialogTheme.primary}`}
                onClick={confirmLocationShare}
              >
                {tStr("pages.chat.continueBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2.5 py-2 border-b border-dark-600 shrink-0 min-w-0 w-full">
        <Link
          href="/app/messages"
          className="app-icon-btn text-dark-500 hover:text-zinc-900 hover:bg-dark-800/80 active:bg-dark-800"
          aria-label={tStr("pages.chat.backAria")}
        >
          ←
        </Link>
        {otherUser ? (
          <div className="app-avatar-wrap w-9 h-9 shrink-0">
            <div className="app-avatar-media">
              <SilhouetteAvatar
                photoUrl={otherUser.photos?.[0]}
                gender={otherUser.gender}
                name={otherUser.name}
                className="w-full h-full text-brand-400"
                imgClassName="w-full h-full object-cover"
              />
            </div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold truncate leading-tight">{displayNameStr}</h2>
          <p className="text-[11px] text-dark-500 truncate">
            {distanceStr != null && <span>{distanceStr}</span>}
            {areFriends && (
              <>
                {distanceStr != null && <span> · </span>}
                {other?.online ? (
                  <span className="text-green-400">{tStr("pages.messages.online")}</span>
                ) : other?.lastActivityAt != null ? (
                  <span>
                    {formatTpl(tStr("pages.chat.lastActiveMin"), {
                      n: Math.floor((Date.now() - other.lastActivityAt) / 60000),
                    })}
                  </span>
                ) : (
                  <span>{tStr("pages.messages.offline")}</span>
                )}
              </>
            )}
          </p>
        </div>
        {callerId ? (
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => setChatOverflowOpen((v) => !v)}
            className="app-icon-btn text-dark-400 hover:text-zinc-900 hover:bg-dark-800/80 border border-dark-600 disabled:opacity-50"
            aria-expanded={chatOverflowOpen}
            aria-haspopup="dialog"
            aria-label={tStr("pages.chat.overflowMenuAria")}
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden />
          </button>
        ) : null}
      </div>

      {chatOverflowOpen && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[240] bg-black/50 backdrop-blur-[1px]"
                aria-label={tStr("pages.chat.cancel")}
                onClick={() => setChatOverflowOpen(false)}
              />
              <div
                ref={overflowMenuRef}
                className="fixed inset-x-0 bottom-0 z-[250] max-h-[min(85dvh,520px)] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-dark-600 bg-night-950 shadow-2xl py-2 text-sm text-zinc-100 pb-app-nav sm:pb-4 lg:inset-x-auto lg:right-4 lg:bottom-4 lg:left-auto lg:w-[min(100vw-2rem,22rem)] lg:max-h-[min(70dvh,480px)] lg:rounded-2xl lg:border lg:pb-4"
                role="dialog"
                aria-modal="true"
                aria-label={tStr("pages.chat.overflowMenuAria")}
              >
                <div className="flex justify-center pt-1 pb-2 lg:hidden" aria-hidden>
                  <span className="h-1 w-10 rounded-full bg-dark-600" />
                </div>
                  {otherUser ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBusy || iHaveBlockedOther}
                      className="w-full px-3 py-2.5 text-left hover:bg-dark-800/90 disabled:opacity-45 disabled:cursor-not-allowed"
                      onClick={async () => {
                        if (!confirm(tStr("pages.chat.blockConfirm"))) return;
                        setActionBusy(true);
                        try {
                          const res = await fetchWithAuthRetry("/api/block", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ targetUserId: otherId }),
                          });
                          if (res.ok) {
                            setSendError(null);
                            setChatInfoMessage(tStr("pages.chat.blockSuccessStay"));
                            setChatOverflowOpen(false);
                            await loadBlockedList();
                            await fetchMessages({ markConversationRead: false });
                          } else {
                            const j = await res.json();
                            const raw = String(j.error ?? "").trim();
                            setSendError(translateApiErrorMessage(raw, tStr) || raw || tStr("pages.chat.errGeneric"));
                          }
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                    >
                      {tStr("pages.chat.overflowBlockUser")}
                    </button>
                  ) : null}
                  <div className="border-t border-dark-600 px-2 py-2 max-h-36 overflow-y-auto overscroll-contain" role="presentation">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-dark-500 px-1 pb-1.5 sticky top-0 bg-night-950">
                      {tStr("pages.chat.blockedUsersHeading")}
                    </p>
                    {blockedListLoading ? (
                      <p className="text-dark-500 px-2 py-1 text-xs">{tStr("pages.chat.loading")}</p>
                    ) : blockedUsersList.length === 0 ? (
                      <p className="text-dark-500 px-2 py-1 text-xs">{tStr("pages.chat.blockedUsersEmpty")}</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {blockedUsersList.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-dark-800/70"
                          >
                            <span className="truncate min-w-0 text-xs text-zinc-200">{blockedRowLabel(row)}</span>
                            <button
                              type="button"
                              disabled={actionBusy}
                              className="shrink-0 rounded-lg border border-dark-500 px-2 py-1 text-[11px] font-medium text-amber-200/95 hover:bg-dark-700 disabled:opacity-50"
                              onClick={async () => {
                                const name = blockedRowLabel(row);
                                if (!confirm(formatTpl(tStr("pages.chat.unblockConfirm"), { name }))) return;
                                setActionBusy(true);
                                try {
                                  const res = await fetchWithAuthRetry("/api/unblock", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ targetUserId: row.id }),
                                  });
                                  if (res.ok) {
                                    setSendError(null);
                                    await loadBlockedList();
                                    if (row.id === otherId) {
                                      await fetchMessages({ markConversationRead: false });
                                    }
                                  } else {
                                    const j = await res.json();
                                    const raw = String(j.error ?? "").trim();
                                    setSendError(
                                      translateApiErrorMessage(raw, tStr) || raw || tStr("pages.chat.errGeneric")
                                    );
                                  }
                                } finally {
                                  setActionBusy(false);
                                }
                              }}
                            >
                              {tStr("pages.chat.unblockUser")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {otherUser ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBusy}
                      className="w-full px-3 py-2.5 text-left hover:bg-dark-800/90 border-t border-dark-600"
                      onClick={async () => {
                        const reason = window.prompt(tStr("pages.chat.reportPrompt"));
                        if (reason === null) return;
                        setActionBusy(true);
                        try {
                          const res = await fetchWithAuthRetry("/api/report", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              targetUserId: otherId,
                              reason: reason || tStr("pages.chat.reportDefaultReason"),
                            }),
                          });
                          if (res.ok) {
                            setSendError(null);
                            setChatOverflowOpen(false);
                          } else {
                            const j = await res.json();
                            const raw = String(j.error ?? "").trim();
                            setSendError(translateApiErrorMessage(raw, tStr) || raw || tStr("pages.chat.errGeneric"));
                          }
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                    >
                      {tStr("pages.chat.overflowReport")}
                    </button>
                  ) : null}
                  {matchId ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={actionBusy}
                      className="w-full px-3 py-2.5 text-left hover:bg-dark-800/90 border-t border-dark-600 text-amber-200/95"
                      onClick={async () => {
                        if (!confirm(tStr("pages.chat.unmatchConfirm"))) return;
                        setActionBusy(true);
                        try {
                          const res = await fetchWithAuthRetry("/api/unmatch", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ matchId }),
                          });
                          if (res.ok) router.replace("/app/profiles");
                          else {
                            const j = await res.json();
                            const raw = String(j.error ?? "").trim();
                            setSendError(translateApiErrorMessage(raw, tStr) || raw || tStr("pages.chat.errGeneric"));
                          }
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                    >
                      {tStr("pages.chat.overflowUnmatch")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionBusy}
                    className="w-full px-3 py-3 text-left hover:bg-red-950/40 border-t border-dark-600 text-red-400 font-medium"
                    onClick={async () => {
                      if (!confirm(tStr("pages.chat.deleteConversationConfirm"))) return;
                      setActionBusy(true);
                      try {
                        const res = await fetchWithAuthRetry("/api/conversations/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ conversationId: otherId }),
                        });
                        if (res.ok) {
                          setChatOverflowOpen(false);
                          router.replace("/app/messages");
                        } else {
                          const j = await res.json();
                          const raw = String(j.error ?? "").trim();
                          setSendError(
                            translateApiErrorMessage(raw, tStr) || raw || tStr("pages.chat.errGeneric")
                          );
                        }
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    {tStr("pages.chat.deleteConversation")}
                  </button>
              </div>
            </>,
            document.body
          )
        : null}

      <div
        ref={messagesScrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-2 pb-3 space-y-2.5 overscroll-contain"
      >
        {fetchError && (
          <p className="text-amber-400 text-sm px-2 py-1 rounded bg-amber-500/10" role="alert">
            {fetchError}
          </p>
        )}
        {conversationBlocked ? (
          <p
            className="text-amber-100/95 text-sm mx-1 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/45 leading-snug"
            role="status"
          >
            {tStr("pages.chat.conversationBlockedBanner")}
          </p>
        ) : null}
        {messages.length === 0 && (
          <p className="text-center text-dark-500 text-sm">
            {tStr("pages.chat.emptyMessages")}
          </p>
        )}
        {messages.map((m) => {
          const fromId = m.fromId != null ? String(m.fromId) : "";
          const isPlatform = !!m.isPlatformNotice;
          const isMe =
            !isPlatform &&
            myIdForTicks !== "" &&
            sameUserId(fromId, myIdForTicks);
          const status = String(m.status ?? "").trim().toUpperCase();
          const isRead = status === "SEEN" || !!m.seenAt;
          const showTick = isMe;
          const senderGender = isMe ? me?.gender : other?.gender;
          const recipientGender = isMe ? other?.gender : me?.gender;
          const locPal = locationShareBubblePalette(senderGender, recipientGender, isMe);
          const tickTitle = m.clientPending
            ? tStr("pages.chat.tickSending")
            : isRead
              ? tStr("pages.chat.tickRead")
              : tStr("pages.chat.tickSent");
          if (isPlatform) {
            return (
              <div key={m.id} className="flex justify-center px-1">
                <div
                  className="max-w-[95%] rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center"
                  role="status"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90 mb-1">
                    {tStr("pages.chat.platformNotice")}
                  </p>
                  {(m.text?.trim() ?? "") ? (
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap break-words">{m.text}</p>
                  ) : null}
                </div>
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  isMe
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white border border-zinc-200 text-zinc-900 shadow-sm"
                }`}
              >
                {m.attachmentUrl && (
                  <div className="mb-2">
                    {(() => {
                      const loc = locationBubbleParsed(m);
                      if (loc) {
                        const gmaps = googleMapsUrl(loc.lat, loc.lng);
                        return (
                          <div className={`rounded-lg border px-3 py-2 text-sm ${locPal.box}`}>
                            <div className="flex items-center gap-2 font-medium">
                              <MapPin className={`w-4 h-4 shrink-0 ${locPal.pin}`} aria-hidden />
                              {tStr("pages.chat.locationSent")}
                            </div>
                            <p className={`text-xs mt-0.5 break-words leading-snug ${locPal.muted}`}>
                              {formatLocationPrimaryLine(loc, 6)}
                            </p>
                            {loc.label ? (
                              <p className={`text-[10px] mt-0.5 tabular-nums ${locPal.muted}`}>
                                {formatLocationCoordsExact(loc.lat, loc.lng, 6)} · WGS84
                              </p>
                            ) : (
                              <p className={`text-[10px] mt-0.5 ${locPal.muted}`}>WGS84</p>
                            )}
                            <a
                              href={gmaps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-block mt-2 text-sm ${locPal.link}`}
                            >
                              {tStr("pages.chat.openGoogleMaps")}
                            </a>
                          </div>
                        );
                      }
                      if (isAlignLocationContentType(m.attachmentContentType)) {
                        return (
                          <div className={`rounded-lg border px-3 py-2 text-sm ${locPal.box}`}>
                            <p className={`text-xs ${locPal.muted}`}>{tStr("pages.chat.locationInvalid")}</p>
                          </div>
                        );
                      }
                      if (isImageType(m.attachmentContentType)) {
                        return (
                          <a
                            href={m.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-full overflow-hidden rounded-xl bg-black/10"
                          >
                            <img
                              src={m.attachmentUrl}
                              alt=""
                              className="mx-auto max-h-[min(52dvh,22rem)] w-full max-w-full object-contain sm:max-h-[min(48dvh,26rem)]"
                            />
                          </a>
                        );
                      }
                      if (isVideoType(m.attachmentContentType)) {
                        return (
                          <video
                            src={m.attachmentUrl ?? undefined}
                            controls
                            playsInline
                            preload="metadata"
                            className="max-h-[min(58dvh,28rem)] w-full max-w-full rounded-xl bg-black/30 sm:max-h-[min(52dvh,32rem)]"
                          />
                        );
                      }
                      return (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm underline"
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          {tStr("pages.chat.openPdf")}
                        </a>
                      );
                    })()}
                  </div>
                )}
                {(m.text?.trim() ?? "") && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {m.text}
                  </p>
                )}
                {showTick && (
                  <div
                    className="min-h-[20px] mt-1 flex justify-end items-center gap-0.5 shrink-0"
                    title={tickTitle}
                    aria-label={tickTitle}
                  >
                    {m.clientPending ? (
                      <Loader2
                        className="w-4 h-4 shrink-0 text-white/90 animate-spin"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    ) : (
                      <Check
                        className={
                          isRead
                            ? "w-[18px] h-[18px] shrink-0 text-white"
                            : "w-4 h-4 shrink-0 text-white/45"
                        }
                        strokeWidth={isRead ? 3 : 1.65}
                        aria-hidden
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={sendMessage}
        className="chat-compose-form flex flex-col gap-1.5 pt-2 shrink-0 w-full min-w-0 max-w-full pb-[max(0.25rem,env(safe-area-inset-bottom,0))]"
      >
        {sendError && (
          <div className="flex flex-col gap-2">
            <p className="text-red-400 text-sm break-words" role="alert">
              {sendError}
            </p>
            {isPaywallError && (
              <Link href="/app/premium" className="text-sm text-brand-400 hover:text-brand-300 font-medium">
                {tStr("pages.chat.paywallLink")}
              </Link>
            )}
          </div>
        )}
        {otherUser && !callerId && (
          <p className="text-xs text-amber-400/90" role="status">
            {tStr("pages.chat.loadingAccountId")}
          </p>
        )}
        {otherUser && callerId && calling ? (
          <p className="text-xs text-dark-500" role="status" aria-live="polite">
            {tStr("pages.chat.callingInProgress")}
          </p>
        ) : null}
        {otherUser && callerId && ringPushHint ? (
          <p className="text-xs text-amber-400/95 leading-snug" role="status">
            {ringPushHint}
          </p>
        ) : null}
        {chatInfoMessage ? (
          <p className="text-emerald-600/95 text-sm px-1" role="status">
            {chatInfoMessage}
          </p>
        ) : null}
        {pendingAttachment && (
          <div className="flex items-center gap-2 text-sm text-dark-300">
            {isImageType(pendingAttachment.contentType) ? (
              <img
                src={pendingAttachment.previewUrl || pendingAttachment.url}
                alt=""
                className="h-12 w-auto rounded object-cover"
              />
            ) : isVideoType(pendingAttachment.contentType) ? (
              <video
                src={pendingAttachment.previewUrl || pendingAttachment.url}
                muted
                playsInline
                className="h-14 w-24 rounded object-cover bg-black/30"
              />
            ) : (
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" /> {tStr("pages.chat.pdfAttached")}
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                setPendingAttachment((p) => {
                  if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl);
                  return null;
                })
              }
              className="p-1 rounded hover:bg-dark-600 text-dark-400"
              aria-label={tStr("pages.chat.removeAttachmentAria")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex w-full min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACH_ACCEPT}
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Pe mobil: unelte pe un rând (centrat, wrap); pe sm+: stânga, compact */}
          <div className="flex w-full min-w-0 flex-nowrap items-center justify-start gap-1.5 overflow-x-auto scrollbar-app sm:w-auto sm:justify-start sm:shrink-0 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                if (!uploadConfigured) {
                  setSendError(tStr("pages.chat.blobConfigHint"));
                  setIsPaywallError(false);
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={composerLocked || uploadingAttachment || sending || sendingLocation}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-dark-700 hover:bg-dark-600 active:bg-dark-600 text-dark-300 disabled:opacity-50 transition shrink-0 touch-manipulation ${!uploadConfigured ? "opacity-60" : ""}`}
              title={
                uploadConfigured
                  ? formatTpl(tStr("pages.chat.attachTitleOk"), { mb: MAX_ATTACH_MB })
                  : tStr("pages.chat.attachTitleNoBlob")
              }
              aria-label={tStr("pages.chat.attachAria")}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => shareCurrentLocation()}
              disabled={composerLocked || uploadingAttachment || sending || sendingLocation}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-dark-700 hover:bg-dark-600 active:bg-dark-600 text-emerald-400 disabled:opacity-50 transition shrink-0 touch-manipulation"
              title={tStr("pages.chat.sendLocationTitle")}
              aria-label={tStr("pages.chat.sendLocationAria")}
            >
              {sendingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.25} aria-hidden />
              ) : (
                <MapPin className="w-5 h-5" aria-hidden />
              )}
            </button>
            {otherUser && callerId && (
              <>
                <button
                  type="button"
                  disabled={composerLocked || !!calling || sending || uploadingAttachment || sendingLocation}
                  onClick={() => void ringAndGoCall(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-brand-500/25 text-brand-400 hover:bg-brand-500/35 border border-brand-500/40 disabled:opacity-50 transition shrink-0 touch-manipulation"
                  title={tStr("pages.chat.videoCallTitle")}
                  aria-label={tStr("pages.chat.videoCallTitle")}
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  disabled={composerLocked || !!calling || sending || uploadingAttachment || sendingLocation}
                  onClick={() => void ringAndGoCall(true)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 border border-sky-500/40 disabled:opacity-50 transition shrink-0 touch-manipulation"
                  title={tStr("pages.chat.audioCallTitle")}
                  aria-label={tStr("pages.chat.audioCallTitle")}
                >
                  <Phone className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {/* Câmp + trimite: întotdeauna un rând propriu pe mobil (lățime completă), ca Send să rămână vizibil */}
          <div className="flex min-w-0 flex-1 gap-2 items-stretch sm:min-w-0">
            <input
              ref={textInputRef}
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSendError(null);
                setChatInfoMessage(null);
              }}
              placeholder={tStr("pages.chat.placeholder")}
              disabled={composerLocked}
              className="min-w-0 flex-1 min-h-[44px] text-base bg-dark-800 border border-dark-600 rounded-xl px-3 sm:px-4 py-3 text-zinc-900 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-500 touch-manipulation disabled:opacity-55"
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              disabled={
                composerLocked ||
                (!text.trim() && !pendingAttachment) ||
                sending ||
                uploadingAttachment ||
                sendingLocation
              }
              className="min-h-[44px] min-w-[48px] sm:min-w-[44px] flex items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-400 active:bg-brand-400 text-dark-900 disabled:opacity-50 transition shrink-0 touch-manipulation px-3 sm:px-0"
              aria-label={tStr("pages.chat.sendAria")}
            >
              <Send className="w-5 h-5 shrink-0" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
