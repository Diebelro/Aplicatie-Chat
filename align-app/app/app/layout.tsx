"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, Compass, MessageCircle, Heart, MapPin, Video, Users, CreditCard, Settings, LogOut, History, Shield, Lightbulb } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { getProfileImageUrl } from "@/lib/profileImage";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import IncomingCall from "@/components/IncomingCall";
import ServiceWorkerAndPush from "@/components/ServiceWorkerAndPush";
import { Watermark } from "@/components/Watermark";
import { displayName } from "@/lib/displayName";
import { LegalDocLinks } from "@/components/LegalDocLinks";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/context";
import { performClientLogout } from "@/lib/clientLogout";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tStr } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [newMatchToast, setNewMatchToast] = useState<{ id: string; name: string } | null>(null);
  /** Puls scurt pe badge mesaje când crește necititul (se diferențiază vizual de toast-ul de match). */
  const [messageBadgePing, setMessageBadgePing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const matchSeenInitializedRef = useRef(false);
  const prevUnreadRef = useRef<number | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SEEN_MATCH_IDS_KEY = "align_seen_match_ids";
  const getSeenMatchIds = (): Set<string> => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = sessionStorage.getItem(SEEN_MATCH_IDS_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };
  const setSeenMatchIds = (ids: string[]) => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(SEEN_MATCH_IDS_KEY, JSON.stringify(ids));
    } catch {}
  };

  // Validare sesiune o singură dată la montare / când avem storage; NU la fiecare schimbare pathname,
  // ca după match → redirect la chat să nu retriggere un /api/me care poate 401 și să pară „m-a scos”.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const raw = typeof window !== "undefined" ? getStoredUserRaw() : null;

    const redirectToLogin = () => {
      const redirect = pathnameRef.current ? `/login?redirect=${encodeURIComponent(pathnameRef.current)}` : "/login";
      router.replace(redirect);
    };

    /** OAuth / cookie-only: fără delay — cookie `align_sid` e deja setată la redirect din align-bridge. */
    if (!raw) {
      let cancelled = false;
      void (async () => {
        try {
          let res = await fetch("/api/me", { credentials: "include" });
          if (cancelled) return;
          if (res.status === 401) {
            await new Promise((r) => setTimeout(r, 400));
            if (cancelled) return;
            res = await fetch("/api/me", { credentials: "include" });
          }
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            const serverUser = data?.user as (User & { isBanned?: boolean }) | undefined;
            if (serverUser?.isBanned) {
              router.replace("/cont-blocat");
              setLoading(false);
              return;
            }
            if (serverUser && typeof window !== "undefined") {
              sessionStorage.setItem("align_user", JSON.stringify(serverUser));
              setUser(serverUser as User);
              setLoading(false);
              return;
            }
          }
        } catch {
          /* fall through */
        }
        if (!cancelled) {
          redirectToLogin();
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    void (async () => {
      try {
        const u = JSON.parse(raw) as User & { isBanned?: boolean };
        if (u.isBanned) {
          if (!cancelled) router.replace("/cont-blocat");
          return;
        }
        let res = await fetch("/api/me", { headers: getAuthHeaders(), credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          await new Promise((r) => setTimeout(r, 400));
          res = await fetch("/api/me", { headers: getAuthHeaders(), credentials: "include" });
          if (cancelled) return;
          if (res.status === 401) {
            if (!cancelled) setUser(u as User);
            setLoading(false);
            return;
          }
        }
        if (!res.ok) {
          if (!cancelled) setUser(u as User);
          setLoading(false);
          return;
        }
        const data = await res.json();
        const serverUser = data?.user as (User & { isBanned?: boolean }) | undefined;
        if (serverUser?.isBanned) {
          router.replace("/cont-blocat");
          return;
        }
        if (typeof window !== "undefined" && serverUser) {
          const fromLocal = !!localStorage.getItem("align_user");
          (fromLocal ? localStorage : sessionStorage).setItem("align_user", JSON.stringify(serverUser));
        }
        setUser((serverUser ?? u) as User);
      } catch {
        if (!cancelled) {
          try {
            const u = JSON.parse(raw) as User;
            setUser(u);
          } catch {
            redirectToLogin();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Dacă userul din state nu are poze (ex. după login cu răspuns minimal), refetch /api/me pentru avatar
  useEffect(() => {
    if (!user?.id || (user.photos?.length ?? 0) > 0) return;
    let cancelled = false;
    fetch("/api/me", { headers: getAuthHeaders(), credentials: "include" })
      .then((r) => (cancelled ? null : r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        const full = data.user as User;
        if (full.photos?.length) {
          setUser(full);
          const fromLocal = !!localStorage.getItem("align_user");
          (fromLocal ? localStorage : sessionStorage).setItem("align_user", JSON.stringify(full));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, user?.photos?.length]);

  // La mesaj nou: necititul crește → puls pe badge (match rămâne pe toast brand; mesaj = sky)
  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = totalUnread;
      return;
    }
    if (totalUnread > prevUnreadRef.current) {
      setMessageBadgePing(true);
      const t = window.setTimeout(() => setMessageBadgePing(false), 2600);
      prevUnreadRef.current = totalUnread;
      return () => window.clearTimeout(t);
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  // Actualizare avatar în header când utilizatorul salvează profilul (ex. poză nouă)
  useEffect(() => {
    const onUserUpdated = (e: Event) => {
      const detail = (e as CustomEvent<User | undefined>).detail;
      if (detail && typeof detail === "object" && detail.id) {
        setUser(detail as User);
        return;
      }
      const raw = typeof window !== "undefined" ? getStoredUserRaw() : null;
      if (raw) try { setUser(JSON.parse(raw) as User); } catch { /* ignore */ }
    };
    window.addEventListener("align_user_updated", onUserUpdated);
    return () => window.removeEventListener("align_user_updated", onUserUpdated);
  }, []);

  // Heartbeat la ~5s → online în timp real (ca WhatsApp)
  useEffect(() => {
    if (!user?.id) return;
    const tick = () => {
      fetch("/api/heartbeat", { method: "POST", headers: getAuthHeaders() }).catch(() => {});
    };
    tick();
    heartbeatRef.current = setInterval(tick, 5000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user?.id]);

  // Trimite locația la încărcare doar dacă utilizatorul a activat-o (onboarding sau pe pagina de căutare)
  useEffect(() => {
    if (!user?.id || user?.location_enabled !== true || typeof navigator === "undefined" || !navigator.geolocation) return;
    const onPos = (pos: GeolocationPosition) => {
      fetch("/api/me/location", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location_enabled: true,
        }),
      }).catch(() => {});
    };
    navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: true });
  }, [user?.id, user?.location_enabled]);

  // Total mesaje necitite pentru badge la Mesaje
  const fetchUnread = () => {
    fetch("/api/me/unread", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.totalUnread != null) setTotalUnread(d.totalUnread); })
      .catch(() => {});
  };
  const fetchMissed = () => {
    fetch("/api/call/missed", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.missed) setMissedCallsCount(d.missed.length); })
      .catch(() => {});
  };
  const fetchMatchesForNotification = () => {
    fetch("/api/matches", { headers: getAuthHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = data?.matches as Array<{ id: string; username?: string; name?: string }> | undefined;
        if (!list || !Array.isArray(list)) return;
        const currentIds = list.map((u) => u.id);
        const seen = getSeenMatchIds();
        if (!matchSeenInitializedRef.current) {
          matchSeenInitializedRef.current = true;
          setSeenMatchIds(currentIds);
          return;
        }
        const newPartners = list.filter((u) => !seen.has(u.id));
        if (newPartners.length > 0) {
          const first = newPartners[0];
          const name = first.username || first.name || tStr("appNav.anonymousUser");
          setNewMatchToast({ id: first.id, name: name.charAt(0).toUpperCase() + name.slice(1) });
          setSeenMatchIds(currentIds);
        }
      })
      .catch(() => {});
  };
  useEffect(() => {
    if (!user?.id) return;
    const UNREAD_MISS_MS = 2500;
    const MATCHES_MS = 15000;
    let unreadMissInterval: ReturnType<typeof setInterval> | null = null;
    let matchesInterval: ReturnType<typeof setInterval> | null = null;

    const clearPolls = () => {
      if (unreadMissInterval != null) {
        clearInterval(unreadMissInterval);
        unreadMissInterval = null;
      }
      if (matchesInterval != null) {
        clearInterval(matchesInterval);
        matchesInterval = null;
      }
    };

    const refreshAll = () => {
      fetchUnread();
      fetchMissed();
      fetchMatchesForNotification();
    };

    const startPolls = () => {
      clearPolls();
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      unreadMissInterval = setInterval(() => {
        fetchUnread();
        fetchMissed();
      }, UNREAD_MISS_MS);
      matchesInterval = setInterval(fetchMatchesForNotification, MATCHES_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshAll();
        startPolls();
      } else {
        clearPolls();
      }
    };

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      refreshAll();
      startPolls();
    }

    document.addEventListener("visibilitychange", onVisibility);
    const onFocus = () => {
      refreshAll();
      if (typeof document !== "undefined" && document.visibilityState === "visible") startPolls();
    };
    const onConversationRead = () => {
      fetchUnread();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("align:conversation-read", onConversationRead);
    return () => {
      clearPolls();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("align:conversation-read", onConversationRead);
    };
  }, [user?.id, tStr]);

  const logout = () => {
    void performClientLogout();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-dark-500">{tStr("appNav.loading")}</div>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";

  const isChatRoute = pathname?.startsWith("/app/chat/") ?? false;

  return (
    <div className="h-dvh min-h-0 bg-dark-900 flex flex-col overflow-hidden">
      <header className="border-b border-dark-600 shrink-0 sticky top-0 z-20 bg-dark-900 safe-area-inset-top">
        <div className="max-w-4xl mx-auto py-3 flex items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <Link href="/app" className="text-lg font-bold gradient-text shrink-0">
            Align
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3 flex-wrap">
            <Link href="/app/profile" className="px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 font-medium text-sm transition">
              {tStr("appNav.completeProfile")}
            </Link>
            <Link href="/app" className="text-dark-400 hover:text-zinc-900 transition">
              {tStr("appNav.discover")}
            </Link>
            <Link href="/app/profiles" className="text-dark-400 hover:text-zinc-900 transition">
              {tStr("appNav.allProfiles")}
            </Link>
            <Link href="/app/messages" className="text-dark-400 hover:text-zinc-900 transition relative inline-flex items-center">
              {tStr("appNav.messages")}
              {totalUnread > 0 && (
                <span
                  className={
                    "ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold flex items-center justify-center text-white bg-sky-500 shadow-md transition-shadow " +
                    (messageBadgePing
                      ? "animate-pulse ring-2 ring-sky-300 ring-offset-2 ring-offset-dark-900 shadow-[0_0_16px_rgba(56,189,248,0.65)]"
                      : "")
                  }
                >
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
            {missedCallsCount > 0 && (
              <Link href="/app/missed-calls" className="text-amber-400 hover:text-amber-300 transition relative inline-flex items-center text-sm">
                {tStr("appNav.missedCalls")}
                <span className="ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/30 text-amber-400 text-xs font-semibold flex items-center justify-center">
                  {missedCallsCount > 99 ? "99+" : missedCallsCount}
                </span>
              </Link>
            )}
            <Link href="/app/call/start" className="text-dark-400 hover:text-zinc-900 transition text-sm">
              {tStr("appNav.conference")}
            </Link>
            <Link href="/app/matches" className="text-dark-400 hover:text-zinc-900 transition">
              {tStr("appNav.matches")}
            </Link>
            <Link
              href="/app/review-swipes"
              className="text-amber-400/90 hover:text-amber-300 transition text-sm"
              title={tStr("appNav.reviewSwipesTitle")}
            >
              {tStr("appNav.reviewSwipes")}
            </Link>
            <Link href="/app/map" className="text-dark-400 hover:text-zinc-900 transition">
              {tStr("appNav.map")}
            </Link>
            <Link href="/app/premium" className="text-amber-400 hover:text-amber-300 transition text-sm">
              {tStr("appNav.premium")}
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-red-300 hover:text-red-200 transition text-sm inline-flex items-center gap-1"
                title={tStr("appNav.adminPanelTitle")}
              >
                <Shield className="w-4 h-4 shrink-0" aria-hidden />
                {tStr("appNav.admin")}
              </Link>
            )}
            <Link href="/app/settings/feedback" className="text-dark-400 hover:text-zinc-900 transition text-sm">
              {tStr("appNav.suggestions")}
            </Link>
            <Link href="/app/settings/account" className="text-dark-400 hover:text-zinc-900 transition text-sm">
              {tStr("appNav.accountSettings")}
            </Link>
            <div className="flex items-center gap-2 border-l border-dark-600 pl-3 shrink-0">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-dark-700">
                <SilhouetteAvatar photoUrl={getProfileImageUrl(user) ?? undefined} gender={user.gender} name={user.name} className="w-full h-full" imgClassName="w-full h-full object-cover object-center" />
              </div>
              <span className="text-dark-400 text-sm truncate max-w-[10rem] lg:max-w-[14rem]">{displayName(user.username ?? user.name)}</span>
            </div>
            <button onClick={logout} className="text-dark-400 hover:text-red-400 text-sm transition">
              {tStr("appNav.logout")}
            </button>
          </nav>
          {/* Mobile: menu toggle + avatar */}
          <div className="flex md:hidden items-center gap-2">
            <Link href="/app/profile" className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-dark-700 flex items-center justify-center">
              <SilhouetteAvatar photoUrl={getProfileImageUrl(user) ?? undefined} gender={user.gender} name={user.name} className="w-full h-full" imgClassName="w-full h-full object-cover object-center" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 rounded-lg text-dark-400 hover:text-zinc-900 hover:bg-dark-700 transition"
              aria-label={mobileMenuOpen ? tStr("appNav.menuClose") : tStr("appNav.menuOpen")}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-600 bg-dark-900 px-4 py-3 flex flex-col gap-1 max-h-[70vh] overflow-y-auto scrollbar-app">
            <Link href="/app/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-brand-400 hover:bg-dark-700">
              <Users className="w-5 h-5 shrink-0" /> {tStr("appNav.completeProfile")}
            </Link>
            <Link href="/app/profiles" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700">
              {tStr("appNav.allProfiles")}
            </Link>
            {missedCallsCount > 0 && (
              <Link href="/app/missed-calls" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-amber-400 hover:bg-dark-700">
                {tStr("appNav.missedCalls")} ({missedCallsCount > 99 ? "99+" : missedCallsCount})
              </Link>
            )}
            <Link href="/app/call/start" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700">
              <Video className="w-5 h-5 shrink-0" /> {tStr("appNav.conference")}
            </Link>
            <Link href="/app/review-swipes" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-amber-400 hover:bg-dark-700">
              <History className="w-5 h-5 shrink-0" /> {tStr("appNav.reviewSwipes")}
            </Link>
            <Link href="/app/map" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700">
              <MapPin className="w-5 h-5 shrink-0" /> {tStr("appNav.map")}
            </Link>
            <Link href="/app/premium" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-amber-400 hover:bg-dark-700">
              <CreditCard className="w-5 h-5 shrink-0" /> {tStr("appNav.premium")}
            </Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-red-300 hover:bg-dark-700">
                <Shield className="w-5 h-5 shrink-0" /> {tStr("appNav.admin")}
              </Link>
            )}
            <Link href="/app/settings/feedback" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700">
              <Lightbulb className="w-5 h-5 shrink-0" /> {tStr("appNav.suggestionsFeedback")}
            </Link>
            <Link href="/app/settings/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700">
              <Settings className="w-5 h-5 shrink-0" /> {tStr("appNav.accountSettings")}
            </Link>
            <button type="button" onClick={() => { logout(); setMobileMenuOpen(false); }} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-red-400 hover:bg-dark-700 text-left w-full">
              <LogOut className="w-5 h-5 shrink-0" /> {tStr("appNav.logout")}
            </button>
          </div>
        )}
      </header>
      <main
        className={
          "flex-1 flex flex-col min-h-0 min-w-0 max-w-4xl w-full mx-auto py-4 md:py-6 pb-24 md:pb-6 " +
          "pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] " +
          (isChatRoute ? "overflow-hidden" : "overflow-y-auto overscroll-y-contain scrollbar-app")
        }
      >
        {children}
        {isChatRoute ? (
          <div className="shrink-0 flex flex-col items-center gap-2 pt-3 pb-1 border-t border-dark-700/70 mt-auto">
            <Link
              href="/privacy"
              className="text-xs font-medium text-brand-400 hover:text-brand-300 hover:underline"
            >
              Privacy Policy
            </Link>
            <LanguageSwitcher compact />
          </div>
        ) : (
          <div className="mt-10 pt-4 border-t border-dark-700/80 shrink-0 flex flex-col items-center gap-4">
            <p className="text-center text-dark-500 text-[10px] md:text-xs px-2">{tStr("appNav.legalFooterIntro")}</p>
            <LegalDocLinks className="text-dark-500" />
            <LanguageSwitcher />
          </div>
        )}
      </main>
      {/* Bottom nav: doar pe mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around touch-manipulation border-t border-dark-600/90 bg-dark-900 shadow-[0_-10px_28px_-6px_rgba(0,0,0,0.55)] safe-area-inset-bottom"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))", paddingTop: "0.5rem" }}
      >
        <Link
          href="/app"
          className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] py-2 px-3 rounded-lg transition text-dark-400 hover:text-zinc-900 active:bg-dark-800"
          title={tStr("appNav.discover")}
        >
          <Compass className="w-6 h-6 shrink-0" />
          <span className="text-xs">{tStr("appNav.discover")}</span>
        </Link>
        <Link
          href="/app/messages"
          className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] py-2 px-3 rounded-lg transition text-dark-400 hover:text-zinc-900 active:bg-dark-800 relative"
          title={tStr("appNav.messages")}
        >
          <MessageCircle className="w-6 h-6 shrink-0" />
          <span className="text-xs">{tStr("appNav.messages")}</span>
          {totalUnread > 0 && (
            <span
              className={
                "absolute top-1.5 right-2 min-w-[1.25rem] h-5 px-1 rounded-full text-white text-xs font-semibold flex items-center justify-center bg-sky-500 shadow-md " +
                (messageBadgePing
                  ? "animate-pulse ring-2 ring-sky-300 ring-offset-2 ring-offset-dark-900 shadow-[0_0_16px_rgba(56,189,248,0.65)]"
                  : "")
              }
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </Link>
        <Link
          href="/app/matches"
          className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] py-2 px-3 rounded-lg transition text-dark-400 hover:text-zinc-900 active:bg-dark-800"
          title={tStr("appNav.matches")}
        >
          <Heart className="w-6 h-6 shrink-0" />
          <span className="text-xs">{tStr("appNav.matches")}</span>
        </Link>
      </nav>
      {newMatchToast && (
        <MatchToast
          name={newMatchToast.name}
          matchId={newMatchToast.id}
          onDismiss={() => setNewMatchToast(null)}
          tStr={tStr}
        />
      )}
      <Watermark />
      <ServiceWorkerAndPush />
      <IncomingCall />
    </div>
  );
}

function MatchToast({
  name,
  matchId,
  onDismiss,
  tStr,
}: {
  name: string;
  matchId: string;
  onDismiss: () => void;
  tStr: (path: string) => string;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div
      role="alert"
      className="fixed bottom-24 md:bottom-6 left-4 right-4 max-w-md mx-auto z-[105] rounded-xl bg-brand-500 text-dark-900 shadow-lg border border-brand-400 p-4 flex items-center justify-between gap-3"
    >
      <p className="font-medium">
        {tStr("appNav.matchWithBefore")}
        <span className="font-semibold">{name}</span>
        {tStr("appNav.matchWithAfter")}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/app/chat/${matchId}`}
          onClick={() => onDismiss()}
          className="px-3 py-1.5 rounded-lg bg-dark-900/20 hover:bg-dark-900/30 font-medium text-sm"
        >
          {tStr("appNav.openChat")}
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-dark-900/20 text-dark-900"
          aria-label={tStr("common.buttons.close")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
