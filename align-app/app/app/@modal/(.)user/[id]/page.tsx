"use client";

import { useParams, usePathname } from "next/navigation";
import PublicUserProfilePage from "../../../user/[id]/page";

/**
 * Soft-nav: profilul e overlay; lista de sub rămâne montată. Fără wrapper aici, default.tsx e gol și nu acoperă pagina.
 *
 * Slotul @modal își păstrează starea la navigarea soft (comportament Next.js): după „Mesaj” → /app/chat/<id>
 * overlay-ul rămânea deasupra chatului și părea că butonul nu face nimic. Randăm overlay-ul DOAR cât timp
 * URL-ul e chiar profilul interceptat.
 */
export default function InterceptedPublicUserProfile() {
  const pathname = usePathname() ?? "";
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id || pathname !== `/app/user/${id}`) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-x-0 z-[40] top-[var(--app-header-height)] bottom-[calc(var(--app-bottom-nav-offset)+var(--safe-area-inset-bottom))] lg:bottom-0 bg-dark-900 overflow-y-auto overscroll-y-contain scrollbar-app"
    >
      <div className="mx-auto w-full max-w-5xl min-h-full">
        <PublicUserProfilePage />
      </div>
    </div>
  );
}
