import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Descarcă Diebel",
  robots: { index: false, follow: false },
};

export default function DownloadPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-dark-900 px-6 py-12 text-center text-zinc-900 safe-area-x pb-[max(6rem,calc(5rem+var(--safe-area-inset-bottom)))] pt-[max(1.5rem,var(--safe-area-inset-top))]">
      <h1 className="text-2xl font-semibold text-zinc-900">Instalează Diebel</h1>
      <p className="text-sm text-zinc-600">
        Descarcă direct de pe site — fără WhatsApp, ca să nu se strice fișierul la trimitere.
      </p>
      <a
        href="/download/diebel.apk"
        download
        className="rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-black touch-manipulation transition hover:bg-emerald-400 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900"
      >
        Descarcă APK (Android)
      </a>
      <ol className="space-y-2 text-left text-sm text-zinc-700">
        <li>1. Dezinstalează Diebel vechi dacă există.</li>
        <li>2. Apasă butonul de mai sus și așteaptă descărcarea completă (~49 MB).</li>
        <li>3. Deschide fișierul din Notificări sau Descărcări → Instalează.</li>
        <li>4. Permite instalare din browser / Fișiere dacă cere.</li>
      </ol>
    </main>
  );
}
