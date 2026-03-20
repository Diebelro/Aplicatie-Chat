import { Info } from "lucide-react";

const MESSAGE = "Site în lucru — funcționalitățile pot fi modificate.";

/** Bandă discretă sus — nu blochează vizual întreaga pagină */
export function InLucruBanner() {
  return (
    <div
      className="sticky top-0 z-[9999] w-full border-b border-white/[0.08] bg-dark-900/95 backdrop-blur-md supports-[backdrop-filter]:bg-dark-900/80"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 sm:py-2.5">
        <Info className="h-3.5 w-3.5 shrink-0 text-amber-400/80 sm:h-4 sm:w-4" aria-hidden />
        <p className="text-center text-[11px] font-medium leading-snug tracking-wide text-dark-400 sm:text-xs">
          {MESSAGE}
        </p>
      </div>
    </div>
  );
}

/** Reminder compact pe pagini (login, signup, etc.) */
export function InLucruReminder() {
  return (
    <p className="rounded-lg border border-white/[0.08] bg-dark-800/60 px-3 py-2 text-center text-xs font-medium text-dark-400">
      {MESSAGE}
    </p>
  );
}
