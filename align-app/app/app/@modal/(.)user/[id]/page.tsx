"use client";

import PublicUserProfilePage from "../../../user/[id]/page";

/** Soft-nav: profilul e overlay; lista de sub rămâne montată. Fără wrapper aici, default.tsx e gol și nu acoperă pagina. */
export default function InterceptedPublicUserProfile() {
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
