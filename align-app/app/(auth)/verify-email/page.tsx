"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la verificare");
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la retrimitere");
      setResendSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Email verificat</h1>
          <p className="text-sm text-dark-300 mt-2">
            Adresa de email a fost confirmată.
          </p>
          <p className="text-sm text-dark-300 mt-2">
            Poți folosi contul complet.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
            >
              Mergi la Log in
            </Link>
          </div>
          <p className="mt-6 text-center text-dark-500 text-sm">
            <Link href="/" className="text-brand-400 hover:underline">
              Înapoi la prima pagină
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <Link href="/login" className="inline-block text-brand-400 font-bold">
          ← Align
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Confirmă email-ul</h1>
        <p className="text-sm text-dark-300 mt-2">
          Apasă butonul de mai jos pentru a confirma adresa de email.
        </p>
        <p className="text-sm text-dark-300 mt-2">
          Dacă nu ai primit linkul, poți cere retrimiterea lui.
        </p>

        <form onSubmit={handleVerify} className="space-y-4 mt-6">
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Se verifică..." : "Verifică email"}
          </button>
        </form>

        <p className="text-sm text-dark-300 opacity-70 text-center mt-4">
          sau
        </p>

        {resendSent ? (
          <p className="text-brand-400 text-sm text-center mt-4">
            Am retrimis linkul de verificare. Verifică emailul.
          </p>
        ) : (
          <form onSubmit={handleResend} className="mt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl border border-dark-600 bg-dark-800 hover:bg-dark-700 text-zinc-900 font-medium text-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {loading ? "Se trimite..." : "Retrimite link verificare"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-dark-500 text-sm">
          Înapoi la{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">Se încarcă...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
