"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminSetupPage() {
  const router = useRouter();
  const [canSetup, setCanSetup] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/setup-status")
      .then((r) => r.json())
      .then((d) => setCanSetup(d.canSetup === true))
      .catch(() => setCanSetup(false));
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSuccess(true);
        } else {
          setError(data.error || "Eroare");
        }
      })
      .catch(() => setError("Eroare de rețea."))
      .finally(() => setBusy(false));
  };

  if (canSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 text-white">
        <p className="text-dark-400">Se încarcă...</p>
      </div>
    );
  }

  if (!canSetup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-dark-900 text-white">
        <h1 className="text-xl font-semibold mb-2">Admin deja configurat</h1>
        <p className="text-dark-400 text-center mb-4">
          Există deja un cont de admin. Loghează-te cu acel cont, apoi mergi la /admin.
        </p>
        <Link href="/login" className="text-brand-400 hover:underline">
          Mergi la Login
        </Link>
        <Link href="/admin" className="mt-2 text-dark-400 hover:text-white">
          Încearcă /admin
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-dark-900 text-white">
        <h1 className="text-xl font-semibold mb-2 text-green-400">Gata!</h1>
        <p className="text-dark-300 text-center mb-4">
          Contul tău a fost făcut admin. Loghează-te cu același email și parolă — vei intra în aplicație și vei vedea butonul{" "}
          <strong className="text-dark-200">Admin</strong> în meniu (nu ești obligat să completezi profilul întâi).
        </p>
        <Link href="/login" className="px-4 py-2 rounded-lg bg-brand-500 text-dark-900 font-medium hover:bg-brand-400">
          Mergi la Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-dark-900 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-2">Configurează primul admin</h1>
        <p className="text-dark-400 text-sm mb-6">
          Nu există încă niciun cont admin. Introdu emailul și parola unui cont existent pentru a-l face admin.
          Dacă nu ai cont, <Link href="/signup" className="text-brand-400 hover:underline">înregistrează-te</Link> mai întâi.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="email@exemplu.com"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Parolă</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Parola contului"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-brand-500 text-dark-900 font-medium hover:bg-brand-400 disabled:opacity-50"
          >
            {busy ? "Se procesează..." : "Fă acest cont admin"}
          </button>
        </form>
        <p className="mt-4 text-dark-500 text-xs text-center">
          <Link href="/" className="hover:text-dark-400">Înapoi la prima pagină</Link>
        </p>
      </div>
    </div>
  );
}
