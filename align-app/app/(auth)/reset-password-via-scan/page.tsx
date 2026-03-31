"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

function ResetPasswordViaScanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Parola trebuie să aibă cel puțin 6 caractere.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password-via-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la resetare");
      if (data.user) {
        localStorage.setItem("align_user", JSON.stringify(data.user));
        if (data.sessionToken) localStorage.setItem("align_session_token", data.sessionToken);
        if (data.deviceId) localStorage.setItem("align_device_id", data.deviceId);
        sessionStorage.removeItem("align_user");
        sessionStorage.removeItem("align_session_token");
        sessionStorage.removeItem("align_device_id");
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Sesiune invalidă</h1>
          <p className="text-sm text-dark-300 mt-2">
            Lipsește sesiunea de recuperare. Încearcă din nou fluxul „Recuperează prin scan”.
          </p>
          <Link href="/forgot-password" className="mt-6 text-brand-400 hover:underline">
            Mergi la Ai uitat parola?
          </Link>
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
        <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Setare parolă nouă</h1>
        <p className="text-sm text-dark-300 mt-2">
          Ai confirmat recuperarea pe telefon. Introdu parola nouă (min. 6 caractere) și confirm-o.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Parola noua (min. 6 caractere)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-zinc-900 transition p-1 rounded"
              aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirmă parola"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-zinc-900 transition p-1 rounded"
              aria-label={showConfirm ? "Ascunde parola" : "Arată parola"}
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Se actualizează..." : "Resetează parola"}
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

export default function ResetPasswordViaScanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">Se încarcă...</div>}>
      <ResetPasswordViaScanContent />
    </Suspense>
  );
}
