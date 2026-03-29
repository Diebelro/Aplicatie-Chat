"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Redirect: profil incomplet → /app/profile (completează profilul), altfel → /app (descoperă).
 * Nu modifică UI-ul; doar redirecționează.
 */
export default function CompleteazaProfilulPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = typeof window !== "undefined" ? (localStorage.getItem("align_user") || sessionStorage.getItem("align_user")) : null;
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(raw) as { role?: string };
      if (u.role === "ADMIN" || u.role === "SUPERADMIN") {
        router.replace("/app");
        return;
      }
    } catch {
      /* fall through */
    }
    router.replace("/app/profile");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900">
      <Link href="/" className="text-brand-400 font-bold">
        ← Align
      </Link>
      <p className="text-dark-400 mt-6">Se încarcă...</p>
    </div>
  );
}
