"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function MobileRecoverContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recovery-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qrToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la confirmare");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Link invalid</h1>
          <p className="text-sm text-dark-300 mt-2">
            Lipsește token-ul de recuperare. Scanează din nou codul QR de pe calculator.
          </p>
          <Link href="/login" className="mt-6 text-brand-400 hover:underline">
            Mergi la Log in
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full text-center">
          <h1 className="text-xl font-semibold text-zinc-900 text-green-400">Confirmat</h1>
          <p className="text-sm text-dark-300 mt-2">
            Recuperarea a fost confirmată. Revino la calculator și setează parola nouă.
          </p>
          <p className="text-sm text-dark-400 mt-4">
            Poți închide această pagină.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <h1 className="text-xl font-semibold text-zinc-900 text-center">
          Recuperare parolă
        </h1>
        <p className="text-sm text-dark-300 mt-2 text-center">
          Ai deschis linkul de pe calculator. Confirmă că acest dispozitiv (telefonul) este al tău pentru a reseta parola pe calculator.
        </p>
        <p className="text-sm text-dark-400 mt-2 text-center">
          Trebuie să fii deja logat pe acest dispozitiv.
        </p>

        <form onSubmit={handleConfirm} className="mt-6">
          {error && (
            <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Se confirmă..." : "Confirmă recuperarea"}
          </button>
        </form>

        <p className="mt-6 text-center text-dark-500 text-sm">
          <Link href="/login" className="text-brand-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function MobileRecoverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">Se încarcă...</div>}>
      <MobileRecoverContent />
    </Suspense>
  );
}
