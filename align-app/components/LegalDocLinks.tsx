import Link from "next/link";

/**
 * Linkuri către documentele legale publice — folosit în app autentificat și unde e util.
 */
export function LegalDocLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Documente legale"
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] md:text-xs ${className}`}
    >
      <Link href="/terms" className="text-brand-400/90 hover:text-brand-300 hover:underline">
        Termeni și condiții
      </Link>
      <span className="text-dark-600 select-none" aria-hidden>
        ·
      </span>
      <Link href="/privacy" className="text-brand-400/90 hover:text-brand-300 hover:underline">
        Confidențialitate (GDPR)
      </Link>
      <span className="text-dark-600 select-none" aria-hidden>
        ·
      </span>
      <Link href="/cookies" className="text-brand-400/90 hover:text-brand-300 hover:underline">
        Politica cookie
      </Link>
    </nav>
  );
}
