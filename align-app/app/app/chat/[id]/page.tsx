"use client";

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Video, Phone, Check, Loader2, Paperclip, X, FileText } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getVideoRoomId } from "@/lib/videoCall";
import { track } from "@/lib/tracking";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";
import { messageAttachmentProxyPath, shouldProxyChatAttachment } from "@/lib/chatAttachmentProxy";
import { clearChatDraft, readChatDraft, writeChatDraft } from "@/lib/formDrafts";

const ALLOWED_ATTACH_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_ATTACH_MB = 10;

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
}

function isImageType(ct: string | null | undefined): boolean {
  return ct === "image/jpeg" || ct === "image/png" || ct === "image/webp";
}

/** Dacă API-ul nu trimite încă currentUserId, deducem „cine sunt eu” din mesaje. */
function inferMyUserIdFromMessages(messages: Message[], otherUserId: string): string | null {
  for (const m of messages) {
    if (m.fromId === otherUserId && m.toId) return m.toId;
    if (m.toId === otherUserId && m.fromId) return m.fromId;
  }
  return null;
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
  const [isPaywallError, setIsPaywallError] = useState(false);
  const [calling, setCalling] = useState<"video" | "audio" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  /** Doar zona listei de mesaje — evită scrollIntoView care poate derula tot viewport-ul și ascunde câmpul de scris. */
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  /** După încărcare conversație: câteva sute de ms ținem lista lipită de jos când crește înălțimea (imagini, font). */
  const pinListToBottomUntilRef = useRef(0);
  const otherPollTickRef = useRef(0);
  const prevMessageCountRef = useRef(0);
  const chatTextRef = useRef("");
  const chatOtherIdRef = useRef("");

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
    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
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
    const res = await fetch(`/api/users/${otherId}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok && data.user) setOther(data.user);
  };

  const fetchMessages = useCallback(
    async (opts?: { markConversationRead?: boolean }) => {
      const markRead = opts?.markConversationRead !== false;
      const q = markRead ? "" : "&markRead=0";
      const res = await fetch(`/api/messages?with=${encodeURIComponent(otherId)}&_=${Date.now()}${q}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
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
        const msg = (data?.error as string) || "Eroare";
        setFetchError(process.env.NODE_ENV === "development" ? `[${code}] ${msg}` : msg);
      }
    },
    [otherId]
  );

  useEffect(() => {
    initialScrollDoneRef.current = false;
    otherPollTickRef.current = 0;
    prevMessageCountRef.current = 0;
    pinListToBottomUntilRef.current = 0;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
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
        await Promise.all([
          fetchOther(),
          fetch("/api/me/read", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ otherId }),
          }).catch(() => null),
          fetchMessages({ markConversationRead: true }),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    fetch("/api/chat/upload", { method: "GET", headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.configured === "boolean") setUploadConfigured(d.configured);
      })
      .catch(() => {
        /* Nu ascunde butonul la rețea eronată — utilizatorul poate reîncerca upload la nevoie. */
      });
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ profileId: otherId }),
    })
      .then(() => track.view_profile(otherId))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [otherId, fetchMessages]);

  /** Poll: fără markRead pe fiecare tick. Pauză cât tab-ul nu e vizibil. */
  const POLL_MS = 2500;
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
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/me/read", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [otherId, loading, fetchMessages]);

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

  /** Deschidere: scroll instant în panoul mesaje. După: doar dacă tu trimiți (sau încă pending), fără scroll pe tot documentul. */
  useLayoutEffect(() => {
    if (loading || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const lastIsMine =
      callerId != null && last != null && String(last.fromId) === String(callerId);
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
    if (grew && (last?.clientPending || lastIsMine)) {
      scrollMessagesToBottom("smooth");
    }
  }, [messages, loading, callerId, scrollMessagesToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = text.trim().length > 0;
    const hasAttach = !!pendingAttachment;
    if ((!hasText && !hasAttach) || sending) return;

    const backupText = text.trim();
    const backupAttach = pendingAttachment;
    const fromIdOptimistic =
      (callerId || meIdFromMeApi || inferredFromMessages || "").trim();
    if (!fromIdOptimistic) {
      setSendError("Se încarcă contul… încearcă din nou imediat.");
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
        setSendError("Nu ești autentificat. Reconectează-te.");
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
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
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
        const paywall = res.status === 402 || (res.status === 403 && data.error?.includes("abonament"));
        setIsPaywallError(!!paywall);
        const code = res.status;
        const msg = data.error || "Eroare la trimitere. Încearcă din nou.";
        setSendError([401, 402, 403, 500].includes(code) && process.env.NODE_ENV === "development" ? `[${code}] ${msg}` : msg);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(backupText);
      setPendingAttachment(backupAttach);
      setIsPaywallError(false);
      setSendError("Eroare de rețea. Mesajul nu s-a salvat; poți retrimite.");
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
      setSendError(`Fișierul depășește ${MAX_ATTACH_MB} MB.`);
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setIsPaywallError(false);
      setSendError("Tip permis: JPEG, PNG, WebP sau PDF.");
      return;
    }
    setUploadingAttachment(true);
    setSendError(null);
    setIsPaywallError(false);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/chat/upload", {
        method: "POST",
        headers: getAuthHeaders() as Record<string, string>,
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url && data.contentType) {
        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        setPendingAttachment((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return { url: data.url as string, contentType: data.contentType as string, previewUrl };
        });
      } else {
        setIsPaywallError(false);
        const msg = data?.error ?? "Eroare la încărcare.";
        const friendly =
          res.status === 503 && (msg.includes("Blob") || msg.includes("configurat"))
            ? "Atașamentele nu sunt disponibile momentan. Poți trimite doar text."
            : msg;
        setSendError(friendly);
        if (res.status === 503) setUploadConfigured(false);
      }
    } catch {
      setIsPaywallError(false);
      setSendError("Eroare la încărcare.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const ringAndGoCall = useCallback(
    async (audioOnly: boolean) => {
      if (!callerId) return;
      setCalling(audioOnly ? "audio" : "video");
      try {
        await fetch("/api/call/ring", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "same-origin",
          body: JSON.stringify({ toId: otherId, audioOnly }),
        });
      } finally {
        setCalling(null);
      }
      const qs = audioOnly ? "?audio=1&from=ring" : "?from=ring";
      router.push(`/app/call/${getVideoRoomId(callerId, otherId)}${qs}`);
    },
    [callerId, otherId, router]
  );

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
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className="flex flex-col gap-3 pb-4 border-b border-dark-600 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/app/profiles"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-dark-500 hover:text-white active:text-white transition shrink-0 touch-manipulation"
            aria-label="Înapoi"
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
        {otherUser && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-dark-500 shrink-0">Apel:</span>
            {!callerId ? (
              <span className="text-xs text-amber-400/90 max-w-[min(100%,220px)]">
                Se încarcă ID cont… Reîncarcă pagina sau iese și intră din nou dacă nu apar butoanele.
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!!calling}
                  onClick={() => void ringAndGoCall(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/25 text-brand-400 hover:bg-brand-500/35 border border-brand-500/40 transition disabled:opacity-50"
                  title="Apel video"
                >
                  <Video className="w-5 h-5" />
                  <span className="text-sm font-medium">Video</span>
                </button>
                <button
                  type="button"
                  disabled={!!calling}
                  onClick={() => void ringAndGoCall(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-600 text-white hover:bg-dark-500 border border-dark-500 transition disabled:opacity-50"
                  title="Apel audio"
                >
                  <Phone className="w-5 h-5" />
                  <span className="text-sm font-medium">Audio</span>
                </button>
              </>
            )}
          </div>
        )}
        {callerId && (
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

      <div
        ref={messagesScrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 space-y-3 overscroll-contain"
      >
        {fetchError && (
          <p className="text-amber-400 text-sm px-2 py-1 rounded bg-amber-500/10" role="alert">
            {fetchError}
          </p>
        )}
        {messages.length === 0 && (
          <p className="text-center text-dark-500 text-sm">
            Niciun mesaj. Scrie ceva mai jos.
          </p>
        )}
        {messages.map((m) => {
          const fromId = m.fromId != null ? String(m.fromId) : "";
          const toId = m.toId != null ? String(m.toId) : "";
          const isMe = callerId != null && fromId === callerId;
          const status = String(m.status ?? "").trim().toUpperCase();
          const isRead = status === "SEEN" || !!m.seenAt;
          const showTick = isMe;
          const tickTitle = m.clientPending
            ? "Se trimite…"
            : isRead
              ? "Citit"
              : "Trimis";
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
                {m.attachmentUrl && (
                  <div className="mb-2">
                    {isImageType(m.attachmentContentType) ? (
                      <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden max-w-full">
                        <img src={m.attachmentUrl} alt="" className="max-h-48 w-auto object-contain rounded-lg" />
                      </a>
                    ) : (
                      <a
                        href={m.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm underline"
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        Deschide PDF
                      </a>
                    )}
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
                        className="w-4 h-4 shrink-0 text-dark-900/85 animate-spin"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                    ) : (
                      <Check
                        className={
                          isRead
                            ? "w-[18px] h-[18px] shrink-0 text-neutral-950"
                            : "w-4 h-4 shrink-0 text-dark-900/25"
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

      <form onSubmit={sendMessage} className="flex flex-col gap-2 pt-4 shrink-0 pb-[env(safe-area-inset-bottom,0)]">
        {sendError && (
          <div className="flex flex-col gap-2">
            <p className="text-red-400 text-sm" role="alert">
              {sendError}
            </p>
            {isPaywallError && (
              <Link href="/app/premium" className="text-sm text-brand-400 hover:text-brand-300 font-medium">
                Vezi abonament
              </Link>
            )}
          </div>
        )}
        {pendingAttachment && (
          <div className="flex items-center gap-2 text-sm text-dark-300">
            {isImageType(pendingAttachment.contentType) ? (
              <img
                src={pendingAttachment.previewUrl || pendingAttachment.url}
                alt=""
                className="h-12 w-auto rounded object-cover"
              />
            ) : (
              <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> PDF atașat</span>
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
              aria-label="Elimină atașament"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACH_ACCEPT}
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              if (!uploadConfigured) {
                setSendError(
                  "Pe Vercel: adaugă BLOB_READ_WRITE_TOKEN (și PDF: BLOB_READ_WRITE_TOKEN_PDF) în Environment Variables. Local cu npm run dev: pozele merg fără Blob (salvare în _chatDev, afișare prin API). Vezi .env.example."
                );
                setIsPaywallError(false);
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={uploadingAttachment || sending}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-dark-700 hover:bg-dark-600 active:bg-dark-600 text-dark-300 disabled:opacity-50 transition shrink-0 touch-manipulation ${!uploadConfigured ? "opacity-60" : ""}`}
            title={
              uploadConfigured
                ? "Atașează poză sau PDF (max 10 MB)"
                : "Lipsește configurarea Blob (BLOB_READ_WRITE_TOKEN) — apasă pentru mesaj"
            }
            aria-label="Atașează fișier"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          {otherUser && callerId && (
            <>
              <button
                type="button"
                disabled={!!calling || sending || uploadingAttachment}
                onClick={() => void ringAndGoCall(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-brand-500/25 text-brand-400 hover:bg-brand-500/35 border border-brand-500/40 disabled:opacity-50 transition shrink-0 touch-manipulation"
                title="Apel video"
                aria-label="Apel video"
              >
                <Video className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={!!calling || sending || uploadingAttachment}
                onClick={() => void ringAndGoCall(true)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-dark-600 text-white hover:bg-dark-500 border border-dark-500 disabled:opacity-50 transition shrink-0 touch-manipulation"
                title="Apel audio"
                aria-label="Apel audio"
              >
                <Phone className="w-5 h-5" />
              </button>
            </>
          )}
          <input
            ref={textInputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSendError(null);
            }}
            placeholder="Scrie un mesaj..."
            className="flex-1 min-h-[44px] text-base bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500 touch-manipulation"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={(!text.trim() && !pendingAttachment) || sending || uploadingAttachment}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-400 active:bg-brand-400 text-dark-900 disabled:opacity-50 transition shrink-0 touch-manipulation"
            aria-label="Trimite mesaj"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
