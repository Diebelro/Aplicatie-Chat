import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-dark-600">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold gradient-text">Align</span>
          <nav className="flex gap-6">
            <Link
              href="/login"
              className="text-dark-500 hover:text-white transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold px-4 py-2 rounded-full transition"
            >
              Inregistrare
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <h1 className="text-4xl md:text-6xl font-bold text-center max-w-3xl mb-6">
          Same intent.{" "}
          <span className="gradient-text">Real connections.</span>
        </h1>
        <p className="text-xl text-dark-500 text-center max-w-xl mb-12">
          Alege intentia ta. Vezi doar oameni care vor acelasi lucru. Fara
          confuzie, fara timp irosit.
        </p>

        <Link
          href="/signup"
          className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold px-8 py-4 rounded-full text-lg transition"
        >
          Incepe acum
        </Link>
      </main>

      <footer className="border-t border-dark-600 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-dark-500">
          <Link href="/terms" className="text-brand-400/90 hover:underline">
            Termeni
          </Link>
          <span className="text-dark-600">·</span>
          <Link href="/privacy" className="text-brand-400/90 hover:underline">
            Confidențialitate
          </Link>
          <span className="text-dark-600">·</span>
          <Link href="/cookies" className="text-brand-400/90 hover:underline">
            Cookie
          </Link>
        </div>
      </footer>
    </div>
  );
}
