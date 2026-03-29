"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { APP_CREDIT } from "@/lib/site";
import { AdminModerationNavBadge } from "@/components/AdminModerationNavBadge";
import { AdminSecurityThreatBanner } from "@/components/AdminSecurityThreatBanner";
import { AdminSystemStrip } from "@/components/AdminSystemStrip";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const isSetupPage = pathname === "/admin/setup";

  useEffect(() => {
    if (isSetupPage) {
      setAllowed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuthRetry("/api/me");
        if (cancelled) return;
        const goLogin = () => {
          const p =
            typeof window !== "undefined" ? window.location.pathname || "/admin" : "/admin";
          router.replace("/login?redirect=" + encodeURIComponent(p));
        };
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) goLogin();
          else router.replace("/app");
          return;
        }
        const data = (await res.json()) as { user?: { role?: string } };
        if (cancelled) return;
        if (!data?.user) {
          goLogin();
          return;
        }
        const role = data.user.role ?? "USER";
        if (role !== "ADMIN" && role !== "SUPERADMIN") {
          if (!cancelled) router.replace("/app");
          return;
        }
        setAllowed(true);
      } catch {
        if (!cancelled) {
          const p = typeof window !== "undefined" ? window.location.pathname || "/admin" : "/admin";
          router.replace("/login?redirect=" + encodeURIComponent(p));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, isSetupPage]);

  if (isSetupPage) {
    return <>{children}</>;
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <p className="text-dark-400">Se încarcă...</p>
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <nav className="border-b border-dark-600 px-4 py-3 flex gap-4 flex-wrap">
        <Link href="/admin" className="text-brand-400 font-bold hover:underline inline-flex items-center">
          Admin
          <AdminModerationNavBadge />
        </Link>
        <Link href="/admin/users" className="text-dark-300 hover:text-white">
          Useri
        </Link>
        <Link href="/admin/reports" className="text-dark-300 hover:text-white">
          Rapoarte
        </Link>
        <Link href="/admin/app-feedback" className="text-dark-300 hover:text-white">
          Feedback app
        </Link>
        <Link href="/admin/ban-appeals" className="text-dark-300 hover:text-white">
          Contestări
        </Link>
        <Link href="/admin/logs" className="text-dark-300 hover:text-white">
          Loguri
        </Link>
        <Link href="/admin/conversations" className="text-dark-300 hover:text-white">
          Conversatii
        </Link>
        <Link href="/admin/moderation-scan" className="text-dark-300 hover:text-white">
          Scanare conținut
        </Link>
        <Link href="/admin/security" className="text-dark-300 hover:text-red-300">
          Securitate
        </Link>
        <Link href="/admin/system" className="text-dark-300 hover:text-emerald-300">
          Bord sistem
        </Link>
        <Link href="/app" className="text-dark-400 ml-auto hover:text-white">
          ← App
        </Link>
      </nav>
      <AdminSecurityThreatBanner />
      <AdminSystemStrip />
      <main className="p-4">{children}</main>
      <footer className="border-t border-dark-600 py-3 px-4 text-center text-dark-500 text-xs">
        {APP_CREDIT}
      </footer>
    </div>
  );
}
