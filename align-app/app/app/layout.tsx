"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, Compass, MessageCircle, Heart, MapPin, Video, Users, CreditCard, Settings, LogOut } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { getProfileImageUrl } from "@/lib/profileImage";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import IncomingCall from "@/components/IncomingCall";
import { Watermark } from "@/components/Watermark";
import { displayName } from "@/lib/displayName";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageRetry, setStorageRetry] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [newMatchToast, setNewMatchToast] = useState<{ id: string; name: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const matchSeenInitializedRef = useRef(false);
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
    if (!raw) {
      if (storageRetry > 0) {
        const redirect = pathnameRef.current ? `/login?redirect=${encodeURIComponent(pathnameRef.current)}` : "/login";
        router.replace(redirect);
        setLoading(false);
        return;
      }
      const t = setTimeout(() => setStorageRetry((r) => r + 1), 100);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    (async () => {
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
            const redirect = pathnameRef.current ? `/login?redirect=${encodeURIComponent(pathnameRef.current)}` : "/login";
            router.replace(redirect);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, storageRetry]);

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
          const name = first.username || first.name || "Cineva";
          setNewMatchToast({ id: first.id, name: name.charAt(0).toUpperCase() + name.slice(1) });
          setSeenMatchIds(currentIds);
        }
      })
      .catch(() => {});
  };
  useEffect(() => {
    if (!user?.id) return;
    fetchUnread();
    fetchMissed();
    fetchMatchesForNotification();
    const t = setInterval(() => { fetchUnread(); fetchMissed(); }, 1000);
    const tMatches = setInterval(fetchMatchesForNotification, 15000);
    const onFocus = () => {
      fetchUnread();
      fetchMissed();
      fetchMatchesForNotification();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      clearInterval(tMatches);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  const logout = () => {
    localStorage.removeItem("align_user");
    sessionStorage.removeItem("align_user");
    localStorage.removeItem("align_session_token");
    localStorage.removeItem("align_device_id");
    localStorage.removeItem("align_device_fingerprint");
    sessionStorage.removeItem("align_session_token");
    sessionStorage.removeItem("align_device_id");
    sessionStorage.removeItem("align_device_fingerprint");
    localStorage.removeItem("align_last_email");
    sessionStorage.removeItem("align_last_email");
    ["username", "identifier", "align_username", "align_identifier"].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    router.replace("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-dark-500">Se încarcă...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col min-h-[100dvh]">
      <header className="border-b border-dark-600 sticky top-0 bg-dark-900/95 backdrop-blur z-20 safe-area-inset-top">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/app" className="text-lg font-bold gradient-text shrink-0">
            Align
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3 flex-wrap">
            <Link href="/app/profile" className="px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 font-medium text-sm transition">
              Completează profilul
            </Link>
            <Link href="/app" className="text-dark-400 hover:text-white transition">Descoperă</Link>
            <Link href="/app/profiles" className="text-dark-400 hover:text-white transition">Toate profilurile</Link>
            <Link href="/app/messages" className="text-dark-400 hover:text-white transition relative inline-flex items-center">
              Mesaje
              {totalUnread > 0 && (
                <span className="ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-500 text-dark-900 text-xs font-semibold flex items-center justify-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
            {missedCallsCount > 0 && (
              <Link href="/app/missed-calls" className="text-amber-400 hover:text-amber-300 transition relative inline-flex items-center text-sm">
                Apeluri pierdute
                <span className="ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/30 text-amber-400 text-xs font-semibold flex items-center justify-center">
                  {missedCallsCount > 99 ? "99+" : missedCallsCount}
                </span>
              </Link>
            )}
            <Link href="/app/call/start" className="text-dark-400 hover:text-white transition text-sm">Conferință</Link>
            <Link href="/app/matches" className="text-dark-400 hover:text-white transition">Matches</Link>
            <Link href="/app/map" className="text-dark-400 hover:text-white transition">Harta</Link>
            <Link href="/app/premium" className="text-amber-400 hover:text-amber-300 transition text-sm">Premium</Link>
            <Link href="/app/settings/account" className="text-dark-400 hover:text-white transition text-sm">Setări cont</Link>
            <div className="flex items-center gap-2 border-l border-dark-600 pl-3">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-dark-700">
                <SilhouetteAvatar photoUrl={getProfileImageUrl(user) ?? undefined} gender={user.gender} name={user.name} className="w-full h-full" imgClassName="w-full h-full object-cover object-center" />
              </div>
              <span className="text-dark-400 text-sm">{displayName(user.username ?? user.name)}</span>
            </div>
            <button onClick={logout} className="text-dark-400 hover:text-red-400 text-sm transition">Ieșire</button>
          </nav>
          {/* Mobile: menu toggle + avatar */}
          <div className="flex md:hidden items-center gap-2">
            <Link href="/app/profile" className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-dark-700 flex items-center justify-center">
              <SilhouetteAvatar photoUrl={getProfileImageUrl(user) ?? undefined} gender={user.gender} name={user.name} className="w-full h-full" imgClassName="w-full h-full object-cover object-center" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition"
              aria-label={mobileMenuOpen ? "Închide meniu" : "Meniu"}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-600 bg-dark-900 px-4 py-3 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
            <Link href="/app/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-brand-400 hover:bg-dark-700"><Users className="w-5 h-5 shrink-0" /> Completează profilul</Link>
            <Link href="/app/profiles" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700">Toate profilurile</Link>
            {missedCallsCount > 0 && (
              <Link href="/app/missed-calls" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-amber-400 hover:bg-dark-700">
                Apeluri pierdute ({missedCallsCount > 99 ? "99+" : missedCallsCount})
              </Link>
            )}
            <Link href="/app/call/start" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700"><Video className="w-5 h-5 shrink-0" /> Conferință</Link>
            <Link href="/app/map" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700"><MapPin className="w-5 h-5 shrink-0" /> Harta</Link>
            <Link href="/app/premium" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-amber-400 hover:bg-dark-700"><CreditCard className="w-5 h-5 shrink-0" /> Premium</Link>
            <Link href="/app/settings/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-dark-300 hover:bg-dark-700"><Settings className="w-5 h-5 shrink-0" /> Setări cont</Link>
            <button type="button" onClick={() => { logout(); setMobileMenuOpen(false); }} className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-red-400 hover:bg-dark-700 text-left w-full"><LogOut className="w-5 h-5 shrink-0" /> Ieșire</button>
          </div>
        )}
      </header>
      <main className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-4 py-4 md:py-6 pb-24 md:pb-6">
        {children}
      </main>
      {/* Bottom nav: doar pe mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-dark-600 bg-dark-900/98 backdrop-blur z-20 flex items-center justify-around safe-area-inset-bottom touch-manipulation" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))", paddingTop: "0.5rem" }}>
        <Link href="/app" className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] py-2 px-3 rounded-lg transition text-dark-400 hover:text-white active:bg-dark-800" title="Descoperă">
          <Compass className="w-6 h-6 shrink-0" />
          <span className="text-xs">Descoperă</span>
        </Link>
        <Link href="/app/messages" className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] py-2 px-3 rounded-lg transition text-dark-400 hover:text-white active:bg-dark-800 relative" title="Mesaje">
          <MessageCircle className="w-6 h-6 shrink-0" />
          <span className="text-xs">Mesaje</span>
          {totalUnread > 0 && (
            <span className="absolute top-1.5 right-2 min-w-[1.25rem] h-5 px-1 rounded-full bg-brand-500 text-dark-900 text-xs font-semibold flex items-center justify-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </Link>
        <Link href="/app/matches" className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[64px] py-2 px-3 rounded-lg transition text-dark-400 hover:text-white active:bg-dark-800" title="Matches">
          <Heart className="w-6 h-6 shrink-0" />
          <span className="text-xs">Matches</span>
        </Link>
      </nav>
      {newMatchToast && (
        <MatchToast
          name={newMatchToast.name}
          matchId={newMatchToast.id}
          onDismiss={() => setNewMatchToast(null)}
        />
      )}
      <Watermark />
      <IncomingCall />
    </div>
  );
}

function MatchToast({
  name,
  matchId,
  onDismiss,
}: {
  name: string;
  matchId: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div
      role="alert"
      className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50 rounded-xl bg-brand-500/95 text-dark-900 shadow-lg border border-brand-400 p-4 flex items-center justify-between gap-3"
    >
      <p className="font-medium">
        Ai match cu <span className="font-semibold">{name}</span>!
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/app/chat/${matchId}`}
          onClick={() => onDismiss()}
          className="px-3 py-1.5 rounded-lg bg-dark-900/20 hover:bg-dark-900/30 font-medium text-sm"
        >
          Deschide chat
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-dark-900/20 text-dark-900"
          aria-label="Închide"
        >
          ×
        </button>
      </div>
    </div>
  );
}
