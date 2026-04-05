"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

function VerifyEmailContent() {
  const { tStr } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const showErr = (msg: string) =>
    translateApiErrorMessage(msg, tStr) || msg || tStr("pages.verifyEmail.errVerify");

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
      const msg = err instanceof Error ? err.message : "";
      setError(showErr(msg));
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
      const msg = err instanceof Error ? err.message : "";
      setError(translateApiErrorMessage(msg, tStr) || msg || tStr("pages.verifyEmail.errResend"));
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            {tStr("pages.verifyEmail.backBrand")}
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.verifyEmail.verifiedTitle")}</h1>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.verifyEmail.verifiedP1")}
          </p>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.verifyEmail.verifiedP2")}
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
            >
              {tStr("pages.verifyEmail.goLogin")}
            </Link>
          </div>
          <p className="mt-6 text-center text-dark-500 text-sm">
            <Link href="/" className="text-brand-400 hover:underline">
              {tStr("pages.verifyEmail.backHome")}
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
          {tStr("pages.verifyEmail.backBrand")}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.verifyEmail.title")}</h1>
        <p className="text-sm text-dark-300 mt-2">
          {tStr("pages.verifyEmail.intro1")}
        </p>
        <p className="text-sm text-dark-300 mt-2">
          {tStr("pages.verifyEmail.intro2")}
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
            {loading ? tStr("pages.verifyEmail.verifying") : tStr("pages.verifyEmail.verifyBtn")}
          </button>
        </form>

        <p className="text-sm text-dark-300 opacity-70 text-center mt-4">
          {tStr("pages.verifyEmail.or")}
        </p>

        {resendSent ? (
          <p className="text-brand-400 text-sm text-center mt-4">
            {tStr("pages.verifyEmail.resentOk")}
          </p>
        ) : (
          <form onSubmit={handleResend} className="mt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl border border-dark-600 bg-dark-800 hover:bg-dark-700 text-zinc-900 font-medium text-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {loading ? tStr("pages.verifyEmail.resendSending") : tStr("pages.verifyEmail.resendBtn")}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-dark-500 text-sm">
          {tStr("pages.verifyEmail.backToLoginLead")}{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            {tStr("pages.verifyEmail.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">
      {tStr("pages.signup.loading")}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
