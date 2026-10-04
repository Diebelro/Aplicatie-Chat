"use client";

import { useEffect, useLayoutEffect, useState, useRef, type MouseEvent, type ReactNode } from "react";
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
  QrCode,
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
import { CallShellExtras } from "@/components/CallShellExtras";
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
import { isCountryGatedAppPath, userMissingCountry } from "@/lib/profileCountries";
import { CountryRequiredBanner } from "@/components/CountryRequiredBanner";
import { getAppShellScrollEl, peekListScroll } from "@/lib/listScrollSession";

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
        : "text-dark-500 hover:text-zinc-900";
  return `shrink-0 pb-0.5 transition-colors text-sm ${line} ${text}`;
}

/** Tab-uri bară jos: linie superioară la tab activ, icon + label vizibil. */
function mobileTabClass(active: boolean): string {
  return (
    "relative flex min-w-0 flex-col items-center justify-center gap-0.5 min-h-[52px] px-1 py-1.5 " +
    "transition-colors duration-100 touch-manipulation active:scale-[0.96] border-t-2 " +
    (active
      ? "border-brand-500 text-brand-500"
      : "border-transparent text-dark-400 hover:text-dark-300")
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

export function AppShell({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
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
    if (typeof document === "undefined") return;
    const p = pathname ?? "";
    const route =
      p.startsWith("/app/chat/") ? "chat" : p.startsWith("/app/call") ? "call" : "app";
    document.documentElement.dataset.diebelRoute = route;
    return () => {
      delete document.documentElement.dataset.diebelRoute;
    };
  }, [pathname]);

  // Fără țară: nu blocăm chatul — doar Descoperă / Profile / Match / Hartă → profil.
  useEffect(() => {
    if (loading || !user) return;
    if (user.mustChangeUsername && pathname !== "/schimba-username") {
      router.replace("/schimba-username");
      return;
    }
    if (!userMissingCountry(user)) return;
    if (!isCountryGatedAppPath(pathname)) return;
    router.replace("/app/profile?needCountry=1");
  }, [loading, user, pathname, router]);

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
            const serverUser = data?.user as (User & { isBanned?: boolean; mustChangeUsername?: boolean }) | undefined;
            if (serverUser?.isBanned) {
              router.replace("/cont-blocat");
              setLoading(false);
              return;
            }
            if (serverUser?.mustChangeUsername) {
              persistUserSafely(serverUser as User);
              router.replace("/schimba-username");
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
        const u = JSON.parse(raw) as User & { isBanned?: boolean; mustChangeUsername?: boolean };
        if (u.isBanned) {
          if (!cancelled) router.replace("/cont-blocat");
          return;
        }
        if (u.mustChangeUsername) {
          if (!cancelled) router.replace("/schimba-username");
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
        const serverUser = data?.user as (User & { isBanned?: boolean; mustChangeUsername?: boolean }) | undefined;
        if (serverUser?.isBanned) {
          router.replace("/cont-blocat");
          return;
        }
        if (serverUser?.mustChangeUsername) {
          persistUserSafely(serverUser as User);
          router.replace("/schimba-username");
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

  /** Prefetch rute frecvente — navigare instant la Mesaje / Matches / Descoperă. */
  useEffect(() => {
    if (!user?.id || loading) return;
    router.prefetch("/app");
    router.prefetch("/app/messages");
    router.prefetch("/app/matches");
  }, [user?.id, loading, router]);

  // La mesaj nou: necititul crește → puls pe badge (match rămâne pe toast brand; mesaj = sky)
  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = totalUnread;
      return;
    }
    if (totalUnread > prevUnreadRef.current) {
      setMessageBadgePing(true);
      const t = window.setTimeout(() => setMessageBadgePing(false), 1200);
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

  useLayoutEffect(() => {
    if (!modal) return;
    if (!(pathname ?? "").startsWith("/app/user/")) return;
    const el = getAppShellScrollEl();
    if (!el) return;
    const y = peekListScroll("profiles") || peekListScroll("matches") || el.scrollTop;
    const apply = () => {
      if (Math.abs(el.scrollTop - y) > 1) el.scrollTop = y;
    };
    apply();
    const t1 = window.setTimeout(apply, 0);
    const t2 = window.setTimeout(apply, 48);
    el.addEventListener("scroll", apply);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      el.removeEventListener("scroll", apply);
    };
  }, [modal, pathname]);

  if (loading || !user) {
    return <AppShellLoadingLayout label={tStr("appNav.loading")} />;
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";

  const isChatRoute = pathname?.startsWith("/app/chat/") ?? false;
  const path = pathname ?? "";
  const isCallRoute = path.startsWith("/app/call");
  /** În conversație / apel: fără bară jos — altfel acoperă câmpul de mesaj. */
  const hideMobileBottomNav = isChatRoute || isCallRoute;
  /** Chat/apel mobil: fără header global dublu — doar header local compact. */
  const hideAppHeaderMobile = isChatRoute || isCallRoute;
  /** Listă conversații (nu chat deschis): footer mai compact pe ecran mic. */
  const isMessagesListRoute = path === "/app/messages";
  /** Profil public full-page. Overlay-ul interceptat se randează din @modal, nu aici. */
  const isPublicProfileRoute = path.startsWith("/app/user/");
  /**
   * © Diebel: în app pe Descoperă, Profil, Setări etc. — NU în chat/listă mesaje (spațiu conversație).
   * Legal + limbă: meniu mobil + Setări cont; credit scurt și aici pe rutele „calme”.
   */
  const showInAppDiebelCredit =
    path.startsWith("/app") &&
    !isChatRoute &&
    !isMessagesListRoute &&
    !path.startsWith("/app/call");
  const navDiscoverActive = path === "/app" || path.startsWith("/app/profiles");
  const navMessagesActive = path.startsWith("/app/messages") || path.startsWith("/app/chat/");
  const navMatchesActive = path.startsWith("/app/matches");
  const navDesktopDiscoverActive = path === "/app";
  const navDesktopProfilesActive = path.startsWith("/app/profiles");
  const navDesktopMessagesActive = path.startsWith("/app/messages") || path.startsWith("/app/chat/");
  const navDesktopMatchesActive = path.startsWith("/app/matches");
  const navDesktopMapActive = path.startsWith("/app/map");
  const navDesktopScanActive = path.startsWith("/app/scan");
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
    <div className="app-shell bg-dark-900 antialiased text-zinc-900">
      <header
        className={
          "app-shell-header border-b border-dark-600/80 shrink-0 bg-dark-800 shadow-sm z-20 " +
          (hideAppHeaderMobile ? "hidden lg:block " : "")
        }
      >
        {/*
          Header pe lățime completă: max-w-4xl doar pe main lasă banda de nav îngustă pe monitor lat
          și taie textul (ex. „Matches”). Conținutul paginilor rămâne centrat în main mai jos.
        */}
        <div className="w-full max-w-[min(100vw,1920px)] mx-auto py-2 md:py-2.5 flex items-center gap-2 sm:gap-3 min-w-0 min-h-[3rem] max-h-[var(--app-header-height)] pl-[max(0.75rem,var(--safe-area-inset-left))] pr-[max(0.75rem,var(--safe-area-inset-right))] pt-[max(0px,var(--safe-area-inset-top))]">
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
            <Link href="/app/scan" className={desktopNavItemClass(navDesktopScanActive)}>
              {tStr("appNav.scanConnect")}
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
            <LanguageSwitcher compact openMenuBelow />
            <button
              type="button"
              onClick={requestOpenLogoutDialog}
              className="shrink-0 text-dark-500 hover:text-red-600 text-sm font-medium transition px-2 py-1.5 rounded-lg hover:bg-dark-700"
            >
              {tStr("appNav.logout")}
            </button>
          </div>
          {/* Mobile / tablet până la lg: meniu + avatar */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <Link
              href="/app/scan"
              aria-label={tStr("appNav.scanConnect")}
              title={tStr("appNav.scanConnect")}
              className={
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 " +
                (navDesktopScanActive
                  ? "text-brand-600 bg-brand-500/10"
                  : "text-dark-500 hover:text-zinc-900 hover:bg-dark-700")
              }
            >
              <QrCode className="w-[22px] h-[22px]" aria-hidden />
            </Link>
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
              className="flex h-11 w-11 items-center justify-center rounded-lg text-dark-500 hover:text-zinc-900 hover:bg-dark-700 transition touch-manipulation"
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
          "app-shell-main w-full min-w-0 " +
          (isChatRoute || isCallRoute
            ? "mx-auto flex flex-col p-0 max-w-none overflow-hidden bg-dark-900 "
            : isMessagesListRoute
              ? "mx-auto max-w-4xl py-1 sm:py-2 overflow-hidden pl-[max(0.75rem,var(--safe-area-inset-left))] pr-[max(0.75rem,var(--safe-area-inset-right))] "
              : isPublicProfileRoute
                ? "overflow-y-auto overscroll-y-contain scrollbar-app py-0 "
              // Scroll pe TOATĂ lățimea (rotița merge și pe margini); conținutul rămâne centrat în div-ul interior.
              : "py-1.5 sm:py-3 lg:py-6 overflow-y-auto overscroll-y-contain scrollbar-app ") +
          "lg:pb-6"
        }
      >
        {user &&
        userMissingCountry(user) &&
        !isChatRoute &&
        !isCallRoute &&
        !(pathname ?? "").startsWith("/app/profile") ? (
          <CountryRequiredBanner />
        ) : null}
        {isChatRoute || isCallRoute || isMessagesListRoute ? (
          <>
            {children}
            {showInAppDiebelCredit ? (
              <div className="mt-6 sm:mt-10 pt-3 sm:pt-4 border-t border-dark-600/80 shrink-0 flex flex-col items-center gap-1 sm:gap-2 relative z-[1]">
                <DiebelCopyrightStrip className="px-2" />
              </div>
            ) : null}
          </>
        ) : isPublicProfileRoute ? (
          <div className="mx-auto w-full max-w-5xl">
            {children}
            {showInAppDiebelCredit ? (
              <div className="mt-6 sm:mt-10 px-4 pt-3 sm:pt-4 border-t border-dark-600/80 flex flex-col items-center gap-1 sm:gap-2 relative z-[1]">
                <DiebelCopyrightStrip className="px-2" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl pl-[max(0.75rem,var(--safe-area-inset-left))] pr-[max(0.75rem,var(--safe-area-inset-right))]">
            {children}
            {showInAppDiebelCredit ? (
              <div className="mt-6 sm:mt-10 pt-3 sm:pt-4 border-t border-dark-600/80 flex flex-col items-center gap-1 sm:gap-2 relative z-[1]">
                <DiebelCopyrightStrip className="px-2" />
              </div>
            ) : null}
          </div>
        )}
      </main>
      {modal}
      {/* Bottom nav: doar pe mobile; ascuns în chat/apel ca să nu acopere inputul */}
      {!hideMobileBottomNav ? (
      <nav
        className="app-shell-nav bottom-nav lg:hidden shrink-0 grid grid-cols-3 items-stretch border-t border-dark-600/80 bg-dark-800 shadow-[0_-2px_12px_rgba(15,23,42,0.08)] z-30"
        style={{
          minHeight: "3.5rem",
          paddingBottom: "max(0.25rem, var(--safe-area-inset-bottom))",
          paddingTop: "0.125rem",
        }}
        aria-label={tStr("appNav.mainNavAria")}
      >
        <a
          href="/app"
          onClick={(e) => onMobileNavClick(e, "/app")}
          className={mobileTabClass(navDiscoverActive)}
          title={tStr("appNav.discover")}
          aria-current={navDiscoverActive ? "page" : undefined}
        >
          <Compass className="w-[22px] h-[22px] shrink-0" />
          <span className="max-w-full truncate text-[11px] font-medium leading-tight">{tStr("appNav.discover")}</span>
        </a>
        <a
          href="/app/messages"
          onClick={(e) => onMobileNavClick(e, "/app/messages")}
          className={`${mobileTabClass(navMessagesActive)} relative`}
          title={tStr("appNav.messages")}
          aria-current={navMessagesActive ? "page" : undefined}
        >
          <MessageCircle className="w-[22px] h-[22px] shrink-0" />
          <span className="max-w-full truncate text-[11px] font-medium leading-tight">{tStr("appNav.messages")}</span>
          {totalUnread > 0 && (
            <span
              className={
                "app-badge-count bg-sky-500 text-white shadow-md max-w-[2.5rem] " +
                (messageBadgePing
                  ? "animate-pulse ring-1 ring-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.55)]"
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
          <Heart className="w-[22px] h-[22px] shrink-0" />
          <span className="max-w-full truncate text-[11px] font-medium leading-tight">{tStr("appNav.matches")}</span>
        </a>
      </nav>
      ) : null}
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
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-dark-600/80 px-3 py-3 pt-[max(0.75rem,var(--safe-area-inset-top))]">
              <p className="truncate text-sm font-semibold tracking-tight text-dark-900">
                {tStr("appNav.mobileSheetTitle")}
              </p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-dark-500 transition hover:bg-dark-700 hover:text-dark-900 touch-manipulation"
                aria-label={tStr("appNav.menuClose")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-[max(1rem,var(--safe-area-inset-bottom))] pt-1 scrollbar-app"
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
                  href="/app/scan"
                  onNavigate={() => setMobileMenuOpen(false)}
                  icon={<QrCode className="h-5 w-5" aria-hidden />}
                >
                  {tStr("appNav.scanConnect")}
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
      <CallShellExtras />
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
      className={`flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${toneCls}`}
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
      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-500/12 active:bg-red-500/18"
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
      className="fixed left-4 right-4 max-w-md mx-auto z-[105] rounded-xl bg-brand-500 text-dark-900 shadow-lg border border-brand-400 p-4 flex items-center justify-between gap-3 bottom-[calc(var(--app-bottom-nav-offset)+0.75rem+var(--safe-area-inset-bottom))] lg:bottom-6"
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
          className="inline-flex min-h-11 items-center px-4 py-2 rounded-lg bg-dark-900/20 hover:bg-dark-900/30 font-medium text-sm touch-manipulation"
        >
          {tStr("appNav.openChat")}
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-dark-900/20 text-dark-900 text-xl leading-none touch-manipulation"
          aria-label={tStr("common.buttons.close")}
        >
          ×
        </button>
      </div>
    </div>
  );
}
