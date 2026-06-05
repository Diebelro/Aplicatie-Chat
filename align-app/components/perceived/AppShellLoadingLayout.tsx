import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DiebelWordmark } from "@/components/DiebelWordmark";

/**
 * Shell vizual asemănător /app/layout în timpul sesiunii inițiale (fără date user).
 * Perceived performance — același flux de autentificare, zero schimbări la API.
 */
export function AppShellLoadingLayout({ label }: { label: string }) {
  return (
    <div
      className="h-dvh min-h-0 bg-dark-900 flex flex-col overflow-hidden antialiased text-dark-900"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <header className="border-b border-dark-600/80 shrink-0 sticky top-0 z-20 safe-area-inset-top bg-dark-900/92 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-dark-900/88">
        <div className="w-full max-w-[min(100vw,1920px)] mx-auto py-3 md:py-3.5 flex items-center gap-2 sm:gap-3 min-w-0 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <Link
            href="/app"
            className="group shrink-0 inline-flex items-center min-h-[44px] min-w-[7.5rem] -ml-1 pl-1 pr-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
          >
            <DiebelWordmark variant="header" withMark />
          </Link>
          <div className="hidden lg:flex flex-1 flex-wrap gap-2 py-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 w-16 rounded-md bg-dark-700/80 animate-pulse" />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto lg:ml-0">
            <div className="h-11 w-11 rounded-full bg-dark-700/90 animate-pulse" />
            <div className="hidden lg:block h-9 w-24 rounded-lg bg-dark-700/80 animate-pulse" />
            <Loader2 className="h-6 w-6 animate-spin text-brand-500/80 shrink-0 lg:hidden" aria-hidden />
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-h-0 min-w-0 max-w-4xl w-full mx-auto py-4 sm:py-6 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-app-nav lg:pb-7">
        <div className="space-y-4 flex-1">
          <div className="h-8 w-48 rounded-lg bg-dark-700/70 animate-pulse" />
          <div className="h-4 w-full max-w-md rounded bg-dark-700/50 animate-pulse" />
          <div className="h-4 w-3/4 max-w-sm rounded bg-dark-700/40 animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-dark-600/50 bg-dark-800/40 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <p className="text-center text-sm text-dark-500 mt-6">{label}</p>
      </main>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-dark-600/60 bg-dark-900/95 backdrop-blur-xl safe-area-inset-bottom py-2"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
        aria-hidden
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 w-16">
            <div className="h-6 w-6 rounded bg-dark-700/80 animate-pulse" />
            <div className="h-2 w-10 rounded bg-dark-700/60 animate-pulse" />
          </div>
        ))}
      </nav>
    </div>
  );
}

/** Card mare tip Discover (swipe). */
export function SkeletonSwipeCard() {
  return (
    <div
      className="w-full max-w-sm mx-auto min-h-[min(320px,50vh)] rounded-2xl border border-dark-600/50 bg-dark-800/40 animate-pulse flex flex-col p-3 gap-3 pointer-events-none"
      aria-hidden
    >
      <div className="flex-1 min-h-[200px] rounded-xl bg-dark-700/35" />
      <div className="h-4 w-3/4 rounded-lg bg-dark-700/45" />
      <div className="h-3 w-1/2 rounded bg-dark-700/40" />
    </div>
  );
}

/** Rânduri-skeleton pentru liste (mesaje, profiluri). */
export function SkeletonConversationList({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl border border-dark-600/40 bg-dark-800/30 p-3 animate-pulse">
          <div className="h-12 w-12 rounded-full bg-dark-700/80 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-32 rounded bg-dark-700/70" />
            <div className="h-3 w-full max-w-[12rem] rounded bg-dark-700/50" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Skeleton pentru zona de chat (antet + bule). */
export function SkeletonChatThread() {
  return (
    <div className="flex flex-col gap-3 min-h-[50vh] py-2" aria-hidden>
      <div className="flex justify-center">
        <div className="h-8 w-40 rounded-full bg-dark-700/50 animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="h-12 max-w-[75%] w-48 rounded-2xl bg-dark-700/40 animate-pulse" />
      </div>
      <div className="flex justify-start">
        <div className="h-14 max-w-[80%] w-56 rounded-2xl bg-dark-700/30 animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 max-w-[60%] w-36 rounded-2xl bg-dark-700/40 animate-pulse" />
      </div>
    </div>
  );
}

/** Carduri profil (grid simplu). */
export function SkeletonProfileGrid({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="aspect-[3/4] rounded-2xl bg-dark-800/50 border border-dark-600/40 animate-pulse" />
      ))}
    </div>
  );
}

/** Câmpuri / bloc profil (setări cont, pagină profil). */
export function SkeletonFormPanel() {
  return (
    <div className="w-full max-w-lg mx-auto space-y-4 py-1" aria-hidden>
      <div className="h-9 w-40 rounded-lg bg-dark-700/70 animate-pulse" />
      <div className="h-11 w-full rounded-xl bg-dark-700/50 animate-pulse" />
      <div className="h-28 w-full rounded-xl bg-dark-700/35 animate-pulse" />
      <div className="h-11 w-full rounded-xl bg-dark-700/45 animate-pulse" />
      <div className="h-10 w-32 rounded-lg bg-dark-600/50 animate-pulse" />
    </div>
  );
}

/** Hartă: zonă mare cu accente discrete (pin-uri). */
export function SkeletonMapPanel() {
  return (
    <div
      className="relative w-full rounded-2xl border border-dark-600/50 bg-dark-800/30 overflow-hidden min-h-[min(420px,55vh)] animate-pulse"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgb(52 52 62) 1px, transparent 1px), linear-gradient(rgb(52 52 62) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute top-[22%] left-[28%] h-2.5 w-2.5 rounded-full bg-brand-500/50 shadow-[0_0_12px_rgba(34,197,94,0.35)]" />
      <div className="absolute top-[38%] right-[32%] h-2.5 w-2.5 rounded-full bg-brand-500/40" />
      <div className="absolute bottom-[30%] left-[48%] h-2.5 w-2.5 rounded-full bg-brand-500/45" />
    </div>
  );
}

/** Planuri premium (3 coloane). */
export function SkeletonPremiumPlans({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="app-pro-panel p-5 flex flex-col animate-pulse space-y-3 min-h-[260px]"
        >
          <div className="h-5 w-24 rounded bg-dark-700/55" />
          <div className="h-3 w-full rounded bg-dark-700/40" />
          <div className="h-8 w-20 rounded bg-dark-700/50" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-3 w-full rounded bg-dark-700/35" />
            ))}
          </div>
          <div className="h-10 w-full rounded-xl bg-dark-700/45" />
        </div>
      ))}
    </div>
  );
}

/** Toggle-uri privacy (profil). */
export function SkeletonPrivacyToggles({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-4 w-4 rounded bg-dark-700/60 shrink-0" />
          <div className="h-4 flex-1 max-w-[14rem] rounded bg-dark-700/40" />
        </div>
      ))}
    </div>
  );
}

/** Carduri tip listă admin (rapoarte, feedback, contestări). */
export function SkeletonAdminStack({ cards = 4 }: { cards?: number }) {
  return (
    <ul className="space-y-4" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl border border-dark-600/50 bg-dark-800/40 p-4 animate-pulse"
        >
          <div className="h-3 w-24 rounded bg-dark-700/70 mb-3" />
          <div className="h-4 w-full max-w-md rounded bg-dark-700/50 mb-2" />
          <div className="h-4 w-4/5 max-w-sm rounded bg-dark-700/40" />
        </li>
      ))}
    </ul>
  );
}

/** Rânduri placeholder tabel admin. */
export function SkeletonAdminTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded border border-dark-600/50" aria-hidden>
      <div className="h-9 bg-dark-700/50 border-b border-dark-600/50 flex gap-2 px-2 items-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 flex-1 rounded bg-dark-600/60 max-w-[5rem]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 border-b border-dark-600/40 flex gap-2 px-2 items-center animate-pulse"
        >
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="h-3 flex-1 rounded bg-dark-700/35 max-w-[6rem]" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Listă useri admin — carduri cu acțiuni. */
export function SkeletonAdminUserCards({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl border border-dark-600/50 bg-dark-800/40 p-4 animate-pulse"
        >
          <div className="flex justify-between gap-3 mb-3">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-5 w-48 max-w-full rounded bg-dark-700/60" />
              <div className="h-3 w-full max-w-xs rounded bg-dark-700/45" />
            </div>
            <div className="h-9 w-28 rounded-lg bg-dark-700/50 shrink-0" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-8 w-16 rounded-md bg-dark-700/35" />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Detaliu user admin. */
export function SkeletonAdminUserDetail() {
  return (
    <div className="max-w-3xl space-y-6" aria-hidden>
      <div className="h-8 w-3/4 max-w-md rounded-lg bg-dark-700/50 animate-pulse" />
      <div className="rounded-xl border border-dark-600/50 p-4 space-y-3 animate-pulse">
        <div className="h-3 w-28 rounded bg-dark-700/50" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-lg bg-dark-700/40" />
          ))}
        </div>
      </div>
      <div className="h-52 rounded-xl border border-dark-600/40 bg-dark-800/30 animate-pulse" />
    </div>
  );
}

/** Dashboard admin — rezumat + carduri generale. */
export function SkeletonAdminDashboard() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="rounded-xl border border-dark-600/50 bg-dark-800/30 p-4 animate-pulse space-y-3">
        <div className="h-6 w-64 rounded bg-dark-700/50" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-dark-700/35" />
          ))}
        </div>
        <div className="h-10 w-56 rounded-lg bg-dark-700/40" />
      </div>
      <div className="h-4 w-40 rounded bg-dark-600/40 animate-pulse" />
      <div className="grid sm:grid-cols-2 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl border border-dark-600/40 bg-dark-800/30 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/** Bord sistem admin (carduri metrici). */
export function SkeletonAdminSystemBoard() {
  return (
    <div className="p-6 max-w-5xl space-y-6" aria-hidden>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="h-4 w-24 rounded bg-dark-700/45 animate-pulse" />
        <div className="h-7 w-48 rounded-lg bg-dark-700/50 animate-pulse" />
        <div className="ml-auto h-8 w-20 rounded-lg bg-dark-700/40 animate-pulse" />
      </div>
      <div className="h-3 w-full max-w-2xl rounded bg-dark-700/30 animate-pulse" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-xl border border-dark-600/40 bg-dark-800/35 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Gate admin: layout / setup înainte de known state.
 * aria: păstrăm mesaj pentru screen readers.
 */
export function SkeletonAdminGate({ label = "Se încarcă…" }: { label?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col bg-dark-900"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-[52px] border-b border-dark-600/50 bg-white/85 animate-pulse shrink-0" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <div className="h-8 w-48 rounded-lg bg-dark-800/70 animate-pulse mx-auto" />
          <div className="h-44 rounded-xl border border-dark-600/40 bg-dark-800/45 animate-pulse" />
          <p className="text-center text-sm text-dark-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
