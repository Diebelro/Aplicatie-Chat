"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

/**
 * Redirect: profil incomplet → /app/profile (completează profilul), altfel → /app (descoperă).
 * Nu modifică UI-ul; doar redirecționează.
 */
export default function CompleteazaProfilulPage() {
  const { tStr } = useI18n();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let raw =
        typeof window !== "undefined"
          ? localStorage.getItem("align_user") || sessionStorage.getItem("align_user")
          : null;
      if (!raw && typeof window !== "undefined") {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            sessionStorage.setItem("align_user", JSON.stringify(data.user));
            raw = JSON.stringify(data.user);
          }
        }
      }
      if (!raw) {
        if (!cancelled) router.replace("/login");
        return;
      }
      try {
        const u = JSON.parse(raw) as { role?: string };
        if (u.role === "ADMIN" || u.role === "SUPERADMIN") {
          if (!cancelled) router.replace("/app");
          return;
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) router.replace("/app/profile");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900" role="status" aria-busy="true">
      <Link href="/" className="text-brand-400 font-bold">
        {tStr("pages.completeProfileRedirect.backBrand")}
      </Link>
      <p className="text-dark-400 mt-6">{tStr("pages.completeProfileRedirect.loading")}</p>
      <div className="mt-4 h-1.5 w-40 rounded-full bg-dark-700/60 animate-pulse" aria-hidden />
    </div>
  );
}
