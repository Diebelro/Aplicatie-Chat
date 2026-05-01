import type { Metadata } from "next";
import Link from "next/link";
import { DiebelWordmark } from "@/components/DiebelWordmark";

export const metadata: Metadata = {
  title: "Ștergere cont și date",
  description:
    "Instrucțiuni pentru ștergerea contului Diebel și a datelor asociate: din aplicație (autentificat) sau prin email la contact@diebel.ro.",
};

/**
 * Pagină publică informativă (Store / utilizatori). Nu apelează API-uri și nu înlocuiește fluxul din Setări cont.
 */
export default function DeleteAccountPublicPage() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-zinc-900 antialiased">
      <header className="border-b border-dark-600 sticky top-0 z-10 bg-dark-900 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center min-h-[44px] min-w-[44px] -ml-1 pl-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900"
            aria-label="Diebel — acasă"
          >
            <DiebelWordmark variant="header" withMark />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-brand-400 hover:text-brand-300 hover:underline"
          >
            Autentificare
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Ștergerea contului și a datelor personale
        </h1>
        <div className="space-y-4 text-sm text-dark-400 leading-relaxed">
          <p>
            Poți solicita ștergerea contului și a datelor asociate în mod durabil. Mai jos sunt cele două căi
            disponibile.
          </p>
          <section className="rounded-xl border border-dark-600/80 bg-dark-800/40 p-4 space-y-2">
            <h2 className="text-base font-semibold text-zinc-200">1. Din aplicație (recomandat)</h2>
            <p>
              După autentificare, deschide{" "}
              <strong className="text-zinc-300">Setări cont</strong> în aplicația web, apoi secțiunea pentru{" "}
              <strong className="text-zinc-300">ștergerea contului</strong>. Este necesară confirmarea cu{" "}
              <strong className="text-zinc-300">parola</strong> contului. Operațiunea este{" "}
              <strong className="text-zinc-300">ireversibilă</strong>.
            </p>
            <p>
              <Link href="/login" className="text-brand-400 font-medium hover:text-brand-300 hover:underline">
                Mergi la autentificare
              </Link>
              {" · "}
              <Link href="/app/settings/account" className="text-brand-400 font-medium hover:text-brand-300 hover:underline">
                Deschide setările contului
              </Link>{" "}
              (necesită sesiune activă).
            </p>
          </section>
          <section className="rounded-xl border border-dark-600/80 bg-dark-800/40 p-4 space-y-2">
            <h2 className="text-base font-semibold text-zinc-200">2. Prin email</h2>
            <p>
              Poți trimite o solicitare la{" "}
              <a
                href="mailto:contact@diebel.ro?subject=Solicitare%20ștergere%20cont%20Diebel"
                className="text-brand-400 font-medium hover:text-brand-300 hover:underline break-all"
              >
                contact@diebel.ro
              </a>
              . Te rugăm să indici adresa de email cu care te-ai înregistrat, ca să putem identifica contul.
            </p>
          </section>
          <p className="text-xs text-dark-500">
            Pentru detalii despre prelucrarea datelor, drepturi și păstrare, consultă{" "}
            <Link href="/privacy" className="text-brand-400 hover:text-brand-300 hover:underline">
              Politica de confidențialitate
            </Link>
            .
          </p>
          <p className="text-xs text-dark-500 border-t border-dark-600/60 pt-4">
            <span className="text-zinc-400 font-medium">English:</span> To delete your account and associated data,
            sign in and use <strong className="text-zinc-500">Account settings → Delete account</strong> (password
            required), or email{" "}
            <a href="mailto:contact@diebel.ro" className="text-brand-400 hover:underline">
              contact@diebel.ro
            </a>{" "}
            from your registered address. See also our{" "}
            <Link href="/privacy" className="text-brand-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
