"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

function MobileRecoverContent() {
  const { tStr } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const showErr = (msg: string) =>
    translateApiErrorMessage(msg, tStr) || msg || tStr("pages.mobileRecover.errGeneric");

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
      const msg = err instanceof Error ? err.message : "";
      setError(showErr(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full text-center">
          <h1 className="text-xl font-semibold text-zinc-900">{tStr("pages.mobileRecover.invalidTitle")}</h1>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.mobileRecover.invalidBody")}
          </p>
          <Link href="/login" className="mt-6 text-brand-400 hover:underline">
            {tStr("pages.mobileRecover.goLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full text-center">
          <h1 className="text-xl font-semibold text-zinc-900 text-green-400">{tStr("pages.mobileRecover.successTitle")}</h1>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.mobileRecover.successP1")}
          </p>
          <p className="text-sm text-dark-400 mt-4">
            {tStr("pages.mobileRecover.closeHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <h1 className="text-xl font-semibold text-zinc-900 text-center">
          {tStr("pages.mobileRecover.title")}
        </h1>
        <p className="text-sm text-dark-300 mt-2 text-center">
          {tStr("pages.mobileRecover.intro1")}
        </p>
        <p className="text-sm text-dark-400 mt-2 text-center">
          {tStr("pages.mobileRecover.intro2")}
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
            {loading ? tStr("pages.mobileRecover.confirming") : tStr("pages.mobileRecover.confirmBtn")}
          </button>
        </form>

        <p className="mt-6 text-center text-dark-500 text-sm">
          <Link href="/login" className="text-brand-400 hover:underline">
            {tStr("pages.mobileRecover.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function MobileRecoverFallback() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">
      {tStr("pages.signup.loading")}
    </div>
  );
}

export default function MobileRecoverPage() {
  return (
    <Suspense fallback={<MobileRecoverFallback />}>
      <MobileRecoverContent />
    </Suspense>
  );
}
