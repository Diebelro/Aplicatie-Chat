import Link from "next/link";
import { APP_AUTHOR, APP_CREDIT } from "@/lib/site";
import { CardUltra } from "@/components/CardUltra";
import { InLucruReminder } from "@/components/InLucruBanner";

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

      <div className="px-4 pt-2 pb-1">
        <InLucruReminder />
      </div>

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

        <div className="w-full max-w-xl mt-16 px-4 flex flex-col gap-4">
          <CardUltra title="Align Premium">
            <p className="text-dark-300 text-sm">Beneficii și condiții pentru planul premium.</p>
          </CardUltra>
        </div>

        <section id="contact" className="w-full max-w-xl mt-24 px-4">
          <h2 className="text-2xl font-semibold text-white mb-4">Contact</h2>
          <form
            action="mailto:contact@diebel.ro"
            method="POST"
            encType="text/plain"
            className="flex flex-col gap-3"
          >
            <input
              id="contact-subject"
              name="subject"
              type="text"
              placeholder="Subiect"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <textarea
              id="contact-message"
              name="body"
              placeholder="Mesaj"
              rows={4}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium transition"
            >
              Trimite
            </button>
          </form>
        </section>
      </main>

      <footer className="border-t border-dark-600 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-dark-500 text-sm">
          © {new Date().getFullYear()} {APP_AUTHOR}. {APP_CREDIT} Toate drepturile rezervate.
        </div>
      </footer>
    </div>
  );
}
