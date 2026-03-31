"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppCreditLine } from "@/components/DiebelAuthorCredit";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import type { Locale } from "@/lib/i18n/types";

function intlLocaleTag(locale: Locale): string {
  if (locale === "en") return "en-US";
  if (locale === "de") return "de-DE";
  return "ro-RO";
}

function ContBlocatForm() {
  const { tStr, locale } = useI18n();
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
          const raw = typeof data.error === "string" ? data.error : "";
          setError(raw ? translateApiErrorMessage(raw, tStr) || raw : tStr("pages.banAppeal.sendFailed"));
          return;
        }
        setDone(true);
      })
      .catch(() => setError(tStr("pages.banAppeal.networkError")))
      .finally(() => setBusy(false));
  };

  if (done) {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-green-400 font-medium">{tStr("pages.banAppeal.doneTitle")}</p>
        <p className="text-dark-400 text-sm mt-2">{tStr("pages.banAppeal.doneBody")}</p>
        <Link href="/login" className="inline-block mt-6 text-brand-400 hover:underline">
          {tStr("pages.banAppeal.backLogin")}
        </Link>
      </div>
    );
  }

  const untilHuman =
    untilIso && !Number.isNaN(new Date(untilIso).getTime())
      ? new Date(untilIso).toLocaleString(intlLocaleTag(locale), { dateStyle: "medium", timeStyle: "short" })
      : null;

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-4">
      {untilHuman && (
        <div className="rounded-lg border border-sky-600/50 bg-sky-950/40 px-3 py-2 text-sky-200 text-sm text-center">
          {formatTpl(tStr("pages.banAppeal.untilBanner"), { until: untilHuman })}
        </div>
      )}
      <p className="text-dark-400 text-sm text-center">
        {tStr("pages.banAppeal.formIntroBefore")}
        <strong className="text-dark-200">{tStr("pages.banAppeal.formIntroBold")}</strong>
        {tStr("pages.banAppeal.formIntroAfter")}
      </p>
      <div>
        <label className="block text-xs text-dark-500 mb-1">{tStr("pages.banAppeal.email")}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900"
        />
      </div>
      <div>
        <label className="block text-xs text-dark-500 mb-1">{tStr("pages.banAppeal.password")}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900"
        />
      </div>
      <div>
        <label className="block text-xs text-dark-500 mb-1">{tStr("pages.banAppeal.messageLabel")}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={5}
          placeholder={tStr("pages.banAppeal.messagePlaceholder")}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 placeholder-dark-500 resize-y min-h-[120px]"
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-lg bg-brand-500 text-dark-900 font-medium hover:bg-brand-400 disabled:opacity-50"
      >
        {busy ? tStr("pages.banAppeal.submitting") : tStr("pages.banAppeal.submit")}
      </button>
    </form>
  );
}

function ContBlocatSuspense() {
  const { tStr } = useI18n();
  return <p className="text-dark-400">{tStr("pages.banAppeal.loading")}</p>;
}

export default function ContBlocatPage() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900">
      <Link href="/" className="text-brand-400 font-bold">
        {tStr("pages.banAppeal.backBrand")}
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 mt-8">{tStr("pages.banAppeal.title")}</h1>
      <p className="text-dark-300 mt-2 text-center max-w-md text-sm">{tStr("pages.banAppeal.subtitle")}</p>
      <div className="mt-8 w-full flex flex-col items-center">
        <Suspense fallback={<ContBlocatSuspense />}>
          <ContBlocatForm />
        </Suspense>
      </div>
      <Link href="/login" className="mt-8 text-dark-400 hover:text-zinc-900 text-sm">
        {tStr("pages.banAppeal.backLogin")}
      </Link>
      <p className="mt-8 text-dark-500 text-xs text-center">
        <AppCreditLine />
      </p>
    </div>
  );
}
