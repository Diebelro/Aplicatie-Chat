"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTokenValid(data.valid === true);
      })
      .catch(() => {
        if (!cancelled) setTokenValid(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Parola trebuie să aibă cel puțin 6 caractere.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <p className="text-dark-400 mt-6">Se verifică linkul…</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <h1 className="text-2xl font-semibold text-white mt-4">Link invalid sau expirat</h1>
          <p className="text-sm text-dark-300 mt-2">
            Linkul de resetare nu este valid sau a expirat. Cere un link nou din „Ai uitat parola?”.
          </p>
          <div className="mt-6">
            <Link
              href="/forgot-password"
              className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
            >
              Mergi la Ai uitat parola?
            </Link>
          </div>
          <p className="mt-6 text-center text-dark-500 text-sm">
            <Link href="/login" className="text-brand-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <h1 className="text-2xl font-semibold text-white mt-4">Parolă actualizată</h1>
          <p className="text-sm text-dark-300 mt-2">
            Parola ta a fost resetată.
          </p>
          <p className="text-sm text-dark-300 mt-2">
            Poți te loga cu noua parolă.
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
        <h1 className="text-2xl font-semibold text-white mt-4">Setare parolă nouă</h1>
        <p className="text-sm text-dark-300 mt-2">
          Introdu parola nouă (min. 6 caractere) și confirm-o.
        </p>
        <p className="text-sm text-dark-300 mt-2">
          Folosește linkul primit pe email pentru a accesa această pagină.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Parolă nouă (min. 6 caractere)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white transition p-1 rounded"
              aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirmă parola"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white transition p-1 rounded"
              aria-label={showConfirmPassword ? "Ascunde parola" : "Arată parola"}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Se actualizează..." : "Actualizează parola"}
          </button>
        </form>

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
