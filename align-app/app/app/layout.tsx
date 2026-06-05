"use client";

import { useEffect, useState, useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  X,
  Compass,
  MessageCircle,
  Heart,
  MapPin,
  Video,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  Lightbulb,
  PhoneMissed,
} from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import {
  ensureSessionCookieForNavigation,
  fetchMeRole,
  fetchWithAuthRetry,
} from "@/lib/authClient";
import { getProfileImageUrl } from "@/lib/profileImage";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import IncomingCall from "@/components/IncomingCall";
import ServiceWorkerAndPush from "@/components/ServiceWorkerAndPush";
import { Watermark } from "@/components/Watermark";
import { displayName } from "@/lib/displayName";
import { LegalDocLinks } from "@/components/LegalDocLinks";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/context";
import { LogoutChoiceModal } from "@/components/LogoutChoiceModal";
import { LOGOUT_DIALOG_OPEN_EVENT, requestOpenLogoutDialog } from "@/lib/logoutDialogEvent";
import { DiebelWordmark } from "@/components/DiebelWordmark";
import { DiebelCopyrightStrip } from "@/components/DiebelAuthorCredit";
import { AppShellLoadingLayout } from "@/components/perceived/AppShellLoadingLayout";
import { AndroidShellInit } from "@/components/AndroidShellInit";
import { AndroidCallAudio } from "@/components/AndroidCallAudio";
import { isPageActive } from "@/lib/pageActive";
import {
  VPS_HEARTBEAT_MS,
  VPS_MATCHES_POLL_MS,
  VPS_UNREAD_MISS_POLL_MS,
} from "@/lib/vpsRealtimeConstants";

type DesktopNavTone = "default" | "brand" | "amber" | "admin";

/** Rută activă în header: doar linie 1px (border-b). Fără fundal / ring / shadow pentru evidențierea activă. */
function desktopNavItemClass(active: boolean, tone: DesktopNavTone = "default"): string {
  const line = `border-b ${active ? "border-brand-500" : "border-transparent"}`;
  if (tone === "brand") {
    return `shrink-0 pb-0.5 text-sm font-medium transition-colors ${line} text-brand-600 hover:text-brand-500`;
  }
  const text =
    tone === "amber"
      ? "text-amber-400/90 hover:text-amber-300"
      : tone === "admin"
        ? "text-red-300 hover:text-red-200"
        : "text-dark-400 hover:text-zinc-900";
  return `shrink-0 pb-0.5 transition-colors text-sm ${line} ${text}`;
}

/** Tab-uri bară jos: același semn — doar linie 1px sub tab-ul activ. */
function mobileTabClass(active: boolean): string {
  return (
    "relative flex flex-col items-center justify-center gap-0.5 min-h-[50px] min-w-[58px] py-1.5 px-2.5 rounded-2xl " +
    "transition-colors duration-200 touch-manipulation active:scale-[0.97] text-dark-400 border-b " +
    (active ? "border-brand-500" : "border-transparent hover:text-dark-900")
  );
}

const MAX_STORED_DATA_URL_CHARS = 200_000;
function sanitizeUserForStorage(u: User): User {
  const cleanPhotos = Array.isArray(u.photos)
    ? u.photos.filter(
        (p) =>
          typeof p === "string" &&
          (!p.startsWith("data:") || p.length <= MAX_STORED_DATA_URL_CHARS)
      )
    : [];
  return { ...u, photos: cleanPhotos };
}

function persistUserSafely(u: User): void {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeUserForStorage(u);
  try {
    const fromLocal = !!localStorage.getItem("align_user");
    (fromLocal ? localStorage : sessionStorage).setItem(
      "align_user",
      JSON.stringify(sanitized)
    );
  } catch {
    // Ignore storage quota errors to avoid breaking the app shell.
  }
}

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
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
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
          const res = await fetchWithAuthRetry("/api/me", { cache: "no-store" });
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
              persistUserSafely(serverUser as User);
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
        const res = await fetchWithAuthRetry("/api/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          if (!cancelled) setUser(u as User);
          setLoading(false);
          return;
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
        if (serverUser) persistUserSafely(serverUser as User);
        setUser((serverUser ?? u) as User);
        if (!cancelled) void ensureSessionCookieForNavigation();
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
    fetchWithAuthRetry("/api/me", { cache: "no-store" })
      .then((r) => (cancelled ? null : r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        const full = data.user as User;
        if (full.photos?.length) {
          setUser(full);
          persistUserSafely(full);
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

  const onMobileNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    // Fără location.assign — reîncărca tot WebView-ul și făcea tab-urile (ex. Match) să „flash-uiască”.
    router.push(href);
  };

  // Heartbeat pe VPS → online în timp real. La revenire în app (Android WebView) — imediat.
  useEffect(() => {
    if (!user?.id) return;
    const tick = () => {
      if (!isPageActive()) return;
      void fetchWithAuthRetry("/api/heartbeat", { method: "POST" }).catch(() => {});
    };
    const start = () => {
      tick();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(tick, VPS_HEARTBEAT_MS);
    };
    const stop = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
    const onVisible = () => {
      if (isPageActive()) start();
      else stop();
    };
    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", start);
    window.addEventListener("focus", tick);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", start);
      window.removeEventListener("focus", tick);
    };
  }, [user?.id]);

  // Locația NU se cere aici: getCurrentPosition fără gest utilizator → prompt care apare/dispare sau e blocat de browser.
  // Actualizare: onboarding / Profil (buton) / Hartă / chat (trimite locația).

  // Total mesaje necitite pentru badge la Mesaje
  const fetchUnread = () => {
    fetchWithAuthRetry("/api/me/unread", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.totalUnread != null) setTotalUnread(d.totalUnread); })
      .catch(() => {});
  };
  const fetchMissed = () => {
    fetchWithAuthRetry("/api/call/missed", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.missed) setMissedCallsCount(d.missed.length); })
      .catch(() => {});
  };
  const fetchMatchesForNotification = () => {
    fetchWithAuthRetry("/api/matches", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
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
    const UNREAD_MISS_MS = VPS_UNREAD_MISS_POLL_MS;
    const MATCHES_MS = VPS_MATCHES_POLL_MS;
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
      if (!isPageActive()) return;
      unreadMissInterval = setInterval(() => {
        fetchUnread();
        fetchMissed();
      }, UNREAD_MISS_MS);
      matchesInterval = setInterval(fetchMatchesForNotification, MATCHES_MS);
    };

    const onVisibility = () => {
      if (isPageActive()) {
        refreshAll();
        startPolls();
      } else {
        clearPolls();
      }
    };

    if (isPageActive()) {
      refreshAll();
      startPolls();
    }

    document.addEventListener("visibilitychange", onVisibility);
    const onFocus = () => {
      refreshAll();
      if (isPageActive()) startPolls();
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onOpenLogout = () => setLogoutDialogOpen(true);
    window.addEventListener(LOGOUT_DIALOG_OPEN_EVENT, onOpenLogout);
    return () => window.removeEventListener(LOGOUT_DIALOG_OPEN_EVENT, onOpenLogout);
  }, []);

  if (loading || !user) {
    return <AppShellLoadingLayout label={tStr("appNav.loading")} />;
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";

  const isChatRoute = pathname?.startsWith("/app/chat/") ?? false;
  const path = pathname ?? "";
  /** Listă conversații (nu chat deschis): footer mai compact pe ecran mic. */
  const isMessagesListRoute = path === "/app/messages";
  /**
   * © Diebel: în app pe Descoperă, Profil, Setări etc. — NU în chat/listă mesaje (spațiu conversație).
   * Legal + limbă: meniu mobil + Setări cont; credit scurt și aici pe rutele „calme”.
   */
  const showInAppDiebelCredit =
    path.startsWith("/app") && !isChatRoute && !isMessagesListRoute;
  const navDiscoverActive = path === "/app" || path.startsWith("/app/profiles");
  const navMessagesActive = path.startsWith("/app/messages") || path.startsWith("/app/chat/");
  const navMatchesActive = path.startsWith("/app/matches");
  const navDesktopDiscoverActive = path === "/app";
  const navDesktopProfilesActive = path.startsWith("/app/profiles");
  const navDesktopMessagesActive = path.startsWith("/app/messages") || path.startsWith("/app/chat/");
  const navDesktopMatchesActive = path.startsWith("/app/matches");
  const navDesktopMapActive = path.startsWith("/app/map");
  const navDesktopPremiumActive = path.startsWith("/app/premium");
  const navDesktopCallActive = path.startsWith("/app/call");
  const navDesktopMissedActive = path.startsWith("/app/missed-calls");
  /** Nu folosi startsWith("/app/profile") — include greșit `/app/profiles`. */
  const navDesktopProfileActive = path === "/app/profile" || path.startsWith("/app/profile/");
  const navDesktopFeedbackActive = path.startsWith("/app/settings/feedback");
  const navDesktopAccountActive = path.startsWith("/app/settings/account");
  const navDesktopAdminActive = path.startsWith("/admin");

  /** Logo → /app: pe Discover ești deja acolo — fără acțiune pare „link mort”. Derulăm sus + închidem meniul mobil. */
  const onDiebelLogoNavClick = (e: MouseEvent<HTMLAnchorElement>) => {
    setMobileMenuOpen(false);
    if (path !== "/app") return;
    e.preventDefault();
    document.querySelector<HTMLElement>("main.flex-1")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** /admin e protejat de middleware doar cu cookie `align_sid`; sincronizăm înainte de navigare. */
  const goToAdmin = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const synced = await ensureSessionCookieForNavigation();
    if (!synced) {
      window.location.href = "/login?redirect=" + encodeURIComponent("/admin");
      return;
    }
    const role = await fetchMeRole();
    if (role === "ADMIN" || role === "SUPERADMIN") {
      window.location.href = "/admin";
      return;
    }
    window.location.href = "/login?redirect=" + encodeURIComponent("/admin");
  };

  return (
    <div className="h-dvh min-h-0 bg-dark-900 flex flex-col overflow-hidden antialiased text-dark-900">
      <header className="border-b border-dark-600/80 shrink-0 sticky top-0 z-20 safe-area-inset-top bg-dark-900/95 backdrop-blur-md">
        {/*
          Header pe lățime completă: max-w-4xl doar pe main lasă banda de nav îngustă pe monitor lat
          și taie textul (ex. „Matches”). Conținutul paginilor rămâne centrat în main mai jos.
        */}
        <div className="w-full max-w-[min(100vw,1920px)] mx-auto py-3 md:py-3.5 flex items-center gap-2 sm:gap-3 min-w-0 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <Link
            href="/app"
            onClick={onDiebelLogoNavClick}
            className="group relative z-[25] shrink-0 inline-flex items-center min-h-[44px] min-w-[7.5rem] -ml-1 pl-1 pr-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900 touch-manipulation active:opacity-90"
            aria-label={tStr("appNav.ariaDiscoverHome")}
          >
            <DiebelWordmark variant="header" withMark />
          </Link>
          {/* Desktop: linkuri în zonă scrollabilă; avatar + profil + Ieșire mereu vizibile în dreapta (nu dispar în overflow). */}
          <nav className="hidden lg:flex min-w-0 flex-1 flex-wrap items-center content-start gap-x-2.5 gap-y-1.5 py-0.5 [&_a]:whitespace-nowrap">
            <Link href="/app/profile" className={desktopNavItemClass(navDesktopProfileActive, "brand")}>
              {tStr("appNav.completeProfile")}
            </Link>
            <Link href="/app" className={desktopNavItemClass(navDesktopDiscoverActive)}>
              {tStr("appNav.discover")}
            </Link>
            <Link href="/app/profiles" className={desktopNavItemClass(navDesktopProfilesActive)}>
              {tStr("appNav.allProfiles")}
            </Link>
            <Link
              href="/app/messages"
              className={`${desktopNavItemClass(navDesktopMessagesActive)} relative inline-flex items-center`}
            >
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
              <Link
                href="/app/missed-calls"
                className={`${desktopNavItemClass(navDesktopMissedActive, "amber")} relative inline-flex items-center`}
              >
                {tStr("appNav.missedCalls")}
                <span className="ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/30 text-amber-400 text-xs font-semibold flex items-center justify-center">
                  {missedCallsCount > 99 ? "99+" : missedCallsCount}
                </span>
              </Link>
            )}
            <Link href="/app/call/start" className={desktopNavItemClass(navDesktopCallActive)}>
              {tStr("appNav.conference")}
            </Link>
            <Link href="/app/matches" className={desktopNavItemClass(navDesktopMatchesActive)}>
              {tStr("appNav.matches")}
            </Link>
            <Link href="/app/map" className={desktopNavItemClass(navDesktopMapActive)}>
              {tStr("appNav.map")}
            </Link>
            <Link href="/app/premium" className={desktopNavItemClass(navDesktopPremiumActive, "amber")}>
              {tStr("appNav.premium")}
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={(e) => void goToAdmin(e)}
                className={`${desktopNavItemClass(navDesktopAdminActive, "admin")} inline-flex items-center gap-1`}
                title={tStr("appNav.adminPanelTitle")}
              >
                <Shield className="w-4 h-4 shrink-0" aria-hidden />
                {tStr("appNav.admin")}
              </Link>
            )}
            <Link href="/app/settings/feedback" className={desktopNavItemClass(navDesktopFeedbackActive)}>
              {tStr("appNav.suggestions")}
            </Link>
            <Link href="/app/settings/account" className={desktopNavItemClass(navDesktopAccountActive)}>
              {tStr("appNav.accountSettings")}
            </Link>
          </nav>
          <div className="hidden lg:flex shrink-0 items-center gap-2 border-l border-dark-600 pl-3 ml-0.5">
            <Link
              href="/app/profile/photo"
              aria-label={tStr("appNav.ariaChangeProfilePhoto")}
              title={tStr("appNav.ariaChangeProfilePhoto")}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full overflow-hidden bg-dark-700 cursor-pointer transition hover:bg-dark-600 hover:ring-2 hover:ring-brand-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <SilhouetteAvatar photoUrl={getProfileImageUrl(user) ?? undefined} gender={user.gender} name={user.name} className="w-full h-full" imgClassName="w-full h-full object-cover object-center" />
            </Link>
            <Link
              href="/app/profile"
              aria-label={tStr("appNav.ariaMyProfile")}
              title={tStr("appNav.ariaMyProfile")}
              className="inline-flex min-h-11 max-w-[8rem] xl:max-w-[12rem] items-center rounded-lg px-2 py-1.5 text-sm text-dark-500 truncate cursor-pointer transition hover:text-zinc-900 hover:bg-dark-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {displayName(user.username ?? user.name)}
            </Link>
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={requestOpenLogoutDialog}
              className="shrink-0 text-dark-400 hover:text-red-400 text-sm font-medium transition px-2 py-1.5 rounded-lg hover:bg-dark-700/80"
            >
              {tStr("appNav.logout")}
            </button>
          </div>
          {/* Mobile / tablet până la lg: meniu + avatar */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <Link
              href="/app/profile/photo"
              aria-label={tStr("appNav.ariaChangeProfilePhoto")}
              title={tStr("appNav.ariaChangeProfilePhoto")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full overflow-hidden bg-dark-700 cursor-pointer transition hover:ring-2 hover:ring-brand-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <SilhouetteAvatar photoUrl={getProfileImageUrl(user) ?? undefined} gender={user.gender} name={user.name} className="w-full h-full" imgClassName="w-full h-full object-cover object-center" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 rounded-lg text-dark-400 hover:text-zinc-900 hover:bg-dark-700 transition"
              aria-label={mobileMenuOpen ? tStr("appNav.menuClose") : tStr("appNav.menuOpen")}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-mobile-drawer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>
      <main
        className={
          "flex-1 flex flex-col min-h-0 min-w-0 max-w-4xl w-full mx-auto " +
          (isChatRoute ? "py-0 " : isMessagesListRoute ? "py-1 sm:py-2 " : "py-2 sm:py-4 lg:py-7 ") +
          "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-7 " +
          "pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] " +
          (isChatRoute
            ? "overflow-hidden"
            : isMessagesListRoute
              ? "overflow-hidden"
              : "overflow-y-auto overscroll-y-contain scrollbar-app")
        }
      >
        {children}
        {showInAppDiebelCredit ? (
          <div className="mt-6 sm:mt-10 pt-3 sm:pt-4 border-t border-dark-700/80 shrink-0 flex flex-col items-center gap-1 sm:gap-2 bg-dark-900 relative z-[1]">
            <DiebelCopyrightStrip className="px-2" />
          </div>
        ) : null}
      </main>
      {/* Bottom nav: doar pe mobile */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-dark-600/60 bg-dark-900/95 backdrop-blur-xl shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.18)] safe-area-inset-bottom"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))", paddingTop: "0.35rem" }}
        aria-label="Navigare principală"
      >
        <a
          href="/app"
          onClick={(e) => onMobileNavClick(e, "/app")}
          className={mobileTabClass(navDiscoverActive)}
          title={tStr("appNav.discover")}
          aria-current={navDiscoverActive ? "page" : undefined}
        >
          <Compass className="w-6 h-6 shrink-0" />
          <span className="text-[11px] leading-tight">{tStr("appNav.discover")}</span>
        </a>
        <a
          href="/app/messages"
          onClick={(e) => onMobileNavClick(e, "/app/messages")}
          className={`${mobileTabClass(navMessagesActive)} relative`}
          title={tStr("appNav.messages")}
          aria-current={navMessagesActive ? "page" : undefined}
        >
          <MessageCircle className="w-6 h-6 shrink-0" />
          <span className="text-[11px] leading-tight">{tStr("appNav.messages")}</span>
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
        </a>
        <a
          href="/app/matches"
          onClick={(e) => onMobileNavClick(e, "/app/matches")}
          className={mobileTabClass(navMatchesActive)}
          title={tStr("appNav.matches")}
          aria-current={navMatchesActive ? "page" : undefined}
        >
          <Heart className="w-6 h-6 shrink-0" />
          <span className="text-[11px] leading-tight">{tStr("appNav.matches")}</span>
        </a>
      </nav>
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex justify-end" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/35 motion-reduce:transition-none"
            aria-label={tStr("appNav.menuClose")}
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            id="app-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={tStr("appNav.mobileSheetTitle")}
            className="relative flex h-full w-[min(19.5rem,calc(100vw-2.5rem))] max-w-[100vw] flex-col border-l border-dark-600 bg-dark-950 shadow-[-16px_0_48px_-12px_rgba(15,23,42,0.18)] ring-1 ring-zinc-900/[0.04]"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-dark-600/80 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <p className="truncate text-sm font-semibold tracking-tight text-dark-900">
                {tStr("appNav.mobileSheetTitle")}
              </p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-dark-500 transition hover:bg-dark-700 hover:text-dark-900"
                aria-label={tStr("appNav.menuClose")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 scrollbar-app"
              onClick={(e) => e.stopPropagation()}
            >
              <MobileMenuSection title={tStr("appNav.mobileSectionProfile")}>
                <MobileNavRow
                  href="/app/profile"
                  onNavigate={() => setMobileMenuOpen(false)}
                  tone="brand"
                  icon={<Users className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.completeProfile")}
                </MobileNavRow>
                <MobileNavRow
                  href="/app/profiles"
                  onNavigate={() => setMobileMenuOpen(false)}
                  icon={<Compass className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.allProfiles")}
                </MobileNavRow>
              </MobileMenuSection>
              <MobileMenuSection title={tStr("appNav.mobileSectionActivity")}>
                {missedCallsCount > 0 && (
                  <MobileNavRow
                    href="/app/missed-calls"
                    onNavigate={(e) => {
                      setMobileMenuOpen(false);
                      void e;
                    }}
                    tone="amber"
                    icon={<PhoneMissed className="h-5 w-5" aria-hidden />}
                  >
                    {tStr("appNav.missedCalls")} ({missedCallsCount > 99 ? "99+" : missedCallsCount})
                  </MobileNavRow>
                )}
                <MobileNavRow
                  href="/app/call/start"
                  onNavigate={() => setMobileMenuOpen(false)}
                  icon={<Video className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.conference")}
                </MobileNavRow>
                <MobileNavRow
                  href="/app/map"
                  onNavigate={() => setMobileMenuOpen(false)}
                  icon={<MapPin className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.map")}
                </MobileNavRow>
                <MobileNavRow
                  href="/app/premium"
                  onNavigate={() => setMobileMenuOpen(false)}
                  tone="amber"
                  icon={<CreditCard className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.premium")}
                </MobileNavRow>
                {isAdmin && (
                  <MobileNavRow
                    href="/admin"
                    onNavigate={(e) => void goToAdmin(e)}
                    tone="danger"
                    icon={<Shield className="h-5 w-5" aria-hidden />}
                  >
                    {tStr("appNav.admin")}
                  </MobileNavRow>
                )}
              </MobileMenuSection>
              <MobileMenuSection title={tStr("appNav.mobileSectionAccount")}>
                <MobileNavRow
                  href="/app/settings/feedback"
                  onNavigate={() => setMobileMenuOpen(false)}
                  icon={<Lightbulb className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.suggestionsFeedback")}
                </MobileNavRow>
                <MobileNavRow
                  href="/app/settings/account"
                  onNavigate={() => setMobileMenuOpen(false)}
                  icon={<Settings className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.accountSettings")}
                </MobileNavRow>
                <MobileNavButton
                  icon={<LogOut className="h-5 w-5" aria-hidden />}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    requestOpenLogoutDialog();
                  }}
                >
                  {tStr("appNav.logout")}
                </MobileNavButton>
              </MobileMenuSection>
              <div className="mt-2 border-t border-dark-600/80 px-3 py-3 flex flex-col items-center gap-2">
                <LanguageSwitcher compact />
                <LegalDocLinks className="text-dark-500 text-[10px] opacity-80" />
                <DiebelCopyrightStrip className="text-[10px] opacity-75 px-1" />
              </div>
            </nav>
          </aside>
        </div>
      )}
      {newMatchToast && (
        <MatchToast
          name={newMatchToast.name}
          matchId={newMatchToast.id}
          onDismiss={() => setNewMatchToast(null)}
          tStr={tStr}
        />
      )}
      <AndroidShellInit />
      <AndroidCallAudio />
      <Watermark />
      <ServiceWorkerAndPush />
      <IncomingCall />
      <LogoutChoiceModal open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)} />
    </div>
  );
}

function MobileMenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-1.5 last:mb-0">
      <h2 className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-dark-500 first:pt-0">
        {title}
      </h2>
      <div className="flex flex-col gap-0">{children}</div>
    </section>
  );
}

type MobileNavTone = "default" | "brand" | "amber" | "danger";

function MobileNavRow({
  href,
  onNavigate,
  icon,
  children,
  tone = "default",
}: {
  href: string;
  onNavigate: (e: MouseEvent<HTMLAnchorElement>) => void;
  icon: ReactNode;
  children: ReactNode;
  tone?: MobileNavTone;
}) {
  const toneCls =
    tone === "brand"
      ? "text-brand-600 hover:bg-brand-500/12 active:bg-brand-500/18"
      : tone === "amber"
        ? "text-amber-600 hover:bg-amber-500/12 active:bg-amber-500/18"
        : tone === "danger"
          ? "text-red-600 hover:bg-red-500/12 active:bg-red-500/18"
          : "text-dark-500 hover:bg-dark-700/85 active:bg-dark-700";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-1 text-sm transition-colors ${toneCls}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dark-700/60 text-current">
        {icon}
      </span>
      <span className="min-w-0 flex-1 font-medium leading-snug">{children}</span>
    </Link>
  );
}

function MobileNavButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 py-1 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-500/12 active:bg-red-500/18"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dark-700/60 text-current">{icon}</span>
      <span>{children}</span>
    </button>
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
      className="fixed bottom-24 lg:bottom-6 left-4 right-4 max-w-md mx-auto z-[105] rounded-xl bg-brand-500 text-dark-900 shadow-lg border border-brand-400 p-4 flex items-center justify-between gap-3"
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
