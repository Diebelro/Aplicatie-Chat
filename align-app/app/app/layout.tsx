"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import IncomingCall from "@/components/IncomingCall";
import { Watermark } from "@/components/Watermark";
import { displayName } from "@/lib/displayName";
import { APP_CREDIT } from "@/lib/site";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? getStoredUserRaw() : null;
    if (!raw) {
      router.replace("/login");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = JSON.parse(raw) as User & { isBanned?: boolean };
        if (u.isBanned) {
          if (!cancelled) router.replace("/cont-blocat");
          return;
        }
        const res = await fetch("/api/me", { headers: getAuthHeaders() });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
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
            router.replace("/login");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Heartbeat la ~8s → online în timp real (doar cât e pe site)
  useEffect(() => {
    if (!user?.id) return;
    const tick = () => {
      fetch("/api/heartbeat", { method: "POST", headers: getAuthHeaders() }).catch(() => {});
    };
    tick();
    heartbeatRef.current = setInterval(tick, 8000);
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
    const t = setInterval(() => { fetchUnread(); fetchMissed(); }, 2000);
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
            <span className="text-dark-400 text-sm border-l border-dark-600 pl-3">{displayName(user.username ?? user.name)}</span>
            <button
              onClick={logout}
              className="text-dark-400 hover:text-red-400 text-sm transition"
            >
              Ieșire
            </button>
            <span
              className="ml-2 px-2.5 py-1 rounded border border-amber-500/60 bg-amber-500/10 text-amber-400 text-xs font-medium"
              title="Aplicația este în dezvoltare"
            >
              În lucru
            </span>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-dark-600 py-3 px-4 text-center text-dark-500 text-xs">
        {APP_CREDIT}
      </footer>
      <Watermark />
      <IncomingCall />
    </div>
  );
}
