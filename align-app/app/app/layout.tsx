"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? getStoredUserRaw() : null;
    if (!raw) {
      // După login, storage poate apărea cu o mică întârziere – așteptăm o dată înainte de redirect
      if (storageRetry > 0) {
        const redirect = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
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
            if (typeof window !== "undefined") {
              localStorage.removeItem("align_user");
              sessionStorage.removeItem("align_user");
              localStorage.removeItem("align_session_token");
              sessionStorage.removeItem("align_session_token");
              localStorage.removeItem("align_device_id");
              sessionStorage.removeItem("align_device_id");
            }
            router.replace("/login");
            setLoading(false);
            return;
          }
        }
        if (!res.ok) {
          setUser(u);
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
            const redirect = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
            router.replace(redirect);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, storageRetry, pathname]);

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
  useEffect(() => {
    if (!user?.id) return;
    fetchUnread();
    fetchMissed();
    const t = setInterval(() => { fetchUnread(); fetchMissed(); }, 1000);
    const onFocus = () => { fetchUnread(); fetchMissed(); };
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
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
    <div className="min-h-screen bg-dark-900 flex flex-col">
      <header className="border-b border-dark-600 sticky top-0 bg-dark-900/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/app" className="text-lg font-bold gradient-text">
            Align
          </Link>
          <nav className="flex items-center gap-3 flex-wrap">
            <Link
              href="/app/profile"
              className="px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 font-medium text-sm transition"
            >
              Completează profilul
            </Link>
            <Link
              href="/app"
              className="text-dark-400 hover:text-white transition"
            >
              Descoperă
            </Link>
            <Link
              href="/app/profiles"
              className="text-dark-400 hover:text-white transition"
            >
              Toate profilurile
            </Link>
            <Link
              href="/app/messages"
              className="text-dark-400 hover:text-white transition relative inline-flex items-center"
            >
              Mesaje
              {totalUnread > 0 && (
                <span className="ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-500 text-dark-900 text-xs font-semibold flex items-center justify-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
            {missedCallsCount > 0 && (
              <Link
                href="/app/missed-calls"
                className="text-amber-400 hover:text-amber-300 transition relative inline-flex items-center text-sm"
              >
                Apeluri pierdute
                <span className="ml-1.5 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/30 text-amber-400 text-xs font-semibold flex items-center justify-center">
                  {missedCallsCount > 99 ? "99+" : missedCallsCount}
                </span>
              </Link>
            )}
            <Link
              href="/app/call/start"
              className="text-dark-400 hover:text-white transition text-sm"
            >
              Conferință
            </Link>
            <Link
              href="/app/matches"
              className="text-dark-400 hover:text-white transition"
            >
              Matches
            </Link>
            <Link
              href="/app/map"
              className="text-dark-400 hover:text-white transition"
            >
              Harta
            </Link>
            <Link
              href="/app/premium"
              className="text-amber-400 hover:text-amber-300 transition text-sm"
            >
              Premium
            </Link>
            <Link
              href="/app/settings/account"
              className="text-dark-400 hover:text-white transition text-sm"
            >
              Setări cont
            </Link>
            <div className="flex items-center gap-2 border-l border-dark-600 pl-3">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-dark-700">
                <SilhouetteAvatar
                  photoUrl={getProfileImageUrl(user) ?? undefined}
                  gender={user.gender}
                  name={user.name}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover object-center"
                />
              </div>
              <span className="text-dark-400 text-sm">{displayName(user.username ?? user.name)}</span>
            </div>
            <button
              onClick={logout}
              className="text-dark-400 hover:text-red-400 text-sm transition"
            >
              Ieșire
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <Watermark />
      <IncomingCall />
    </div>
  );
}
