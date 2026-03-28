"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { APP_CREDIT } from "@/lib/site";

function ContBlocatForm() {
  const searchParams = useSearchParams();
  const prefEmail = searchParams.get("email") ?? "";
  const untilIso = searchParams.get("until");
  const [email, setEmail] = useState(prefEmail);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    fetch("/api/ban-appeal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, message }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(typeof data.error === "string" ? data.error : "Nu s-a putut trimite cererea.");
          return;
        }
        setDone(true);
      })
      .catch(() => setError("Eroare de rețea."))
      .finally(() => setBusy(false));
  };

  if (done) {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-green-400 font-medium">Cererea ta a fost trimisă.</p>
        <p className="text-dark-400 text-sm mt-2">
          Un administrator o va citi. Dacă decidem că blocarea a fost o greșeală, îți vom reactiva contul. Nu
          primi neapărat un email automat — încearcă să te loghezi din nou după ceva timp.
        </p>
        <Link href="/login" className="inline-block mt-6 text-brand-400 hover:underline">
          Înapoi la login
        </Link>
      </div>
    );
  }

  const untilHuman =
    untilIso && !Number.isNaN(new Date(untilIso).getTime())
      ? new Date(untilIso).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })
      : null;

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-4">
      {untilHuman && (
        <div className="rounded-lg border border-sky-600/50 bg-sky-950/40 px-3 py-2 text-sky-200 text-sm text-center">
          Acces suspendat temporar până la <strong>{untilHuman}</strong>. După această oră te poți loga din nou (dacă nu e prelungit sau transformat în ban permanent).
        </div>
      )}
      <p className="text-dark-400 text-sm text-center">
        Crezi că ai fost blocat nedrept? Completează formularul. Folosește <strong className="text-dark-200">același email și parolă</strong> ca la cont.
      </p>
      <div>
        <label className="block text-xs text-dark-500 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-dark-500 mb-1">Parolă</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-dark-500 mb-1">Mesaj către admin (min. 10 caractere)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={5}
          placeholder="Explică pe scurt de ce crezi că blocarea nu e justificată..."
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-dark-500 resize-y min-h-[120px]"
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-lg bg-brand-500 text-dark-900 font-medium hover:bg-brand-400 disabled:opacity-50"
      >
        {busy ? "Se trimite…" : "Trimite contestația"}
      </button>
    </form>
  );
}

export default function ContBlocatPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900">
      <Link href="/" className="text-brand-400 font-bold">
        ← Align
      </Link>
      <h1 className="text-2xl font-semibold text-white mt-8">Cont blocat</h1>
      <p className="text-dark-300 mt-2 text-center max-w-md text-sm">
        Contul tău a fost blocat de la accesarea aplicației.
      </p>
      <div className="mt-8 w-full flex flex-col items-center">
        <Suspense fallback={<p className="text-dark-400">Se încarcă…</p>}>
          <ContBlocatForm />
        </Suspense>
      </div>
      <Link href="/login" className="mt-8 text-dark-400 hover:text-white text-sm">
        Înapoi la login
      </Link>
      <p className="mt-8 text-dark-500 text-xs text-center">{APP_CREDIT}</p>
    </div>
  );
}
