"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";
import { APP_CREDIT } from "@/lib/site";

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
    fetch("/api/me", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) {
          router.replace("/admin/setup");
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.user) {
          router.replace("/admin/setup");
          return;
        }
        const role = (data.user as { role?: string }).role ?? "USER";
        if (role !== "ADMIN" && role !== "SUPERADMIN") {
          router.replace("/admin/setup");
          return;
        }
        setAllowed(true);
      })
      .catch(() => router.replace("/admin/setup"));
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
        <Link href="/admin" className="text-brand-400 font-bold hover:underline">
          Admin
        </Link>
        <Link href="/admin/users" className="text-dark-300 hover:text-white">
          Useri
        </Link>
        <Link href="/admin/reports" className="text-dark-300 hover:text-white">
          Rapoarte
        </Link>
        <Link href="/admin/logs" className="text-dark-300 hover:text-white">
          Loguri
        </Link>
        <Link href="/admin/conversations" className="text-dark-300 hover:text-white">
          Conversatii
        </Link>
        <Link href="/app" className="text-dark-400 ml-auto hover:text-white">
          ← App
        </Link>
      </nav>
      <main className="p-4">{children}</main>
      <footer className="border-t border-dark-600 py-3 px-4 text-center text-dark-500 text-xs">
        {APP_CREDIT}
      </footer>
    </div>
  );
}
