"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";
import { clearFeedbackDraft, readFeedbackDraft, writeFeedbackDraft } from "@/lib/formDrafts";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

const MAX_LEN = 8000;
const MIN_LEN = 8;

export default function AppFeedbackPage() {
  const { tStr } = useI18n();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useLayoutEffect(() => {
    setMessage(readFeedbackDraft());
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => writeFeedbackDraft(message), 450);
    return () => clearTimeout(t);
  }, [message]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      const pageUrl = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "";
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          message: message.trim(),
          pageUrl: pageUrl.slice(0, 2000),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = typeof data.error === "string" ? data.error : "";
        setError(
          raw
            ? translateApiErrorMessage(raw, tStr) || raw
            : tStr("pages.feedback.sendFailed")
        );
        return;
      }
      setOk(true);
      setMessage("");
      clearFeedbackDraft();
    } catch {
      setError(tStr("pages.feedback.networkError"));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full min-h-[160px] bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-base";

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/app/settings/account" className="text-dark-400 hover:text-zinc-900 transition text-sm shrink-0">
          {tStr("pages.feedback.backToAccount")}
        </Link>
        <h1 className="app-pro-page-title">{tStr("pages.feedback.title")}</h1>
      </div>

      <p className="app-pro-lead text-dark-400">
        {tStr("pages.feedback.introBefore")}
        <strong className="text-dark-300">{tStr("pages.feedback.introTab")}</strong>
        {tStr("pages.feedback.introAfter")}
      </p>

      <form onSubmit={(e) => void submit(e)} className="app-pro-panel p-6 space-y-4">
        <div>
          <label htmlFor="feedback-msg" className="block text-dark-500 text-sm mb-2">
            {tStr("pages.feedback.yourMessage")}
          </label>
          <textarea
            id="feedback-msg"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
              setOk(false);
            }}
            className={inputClass}
            placeholder={tStr("pages.feedback.placeholder")}
            maxLength={MAX_LEN}
            disabled={busy}
          />
          <p className="text-dark-600 text-xs mt-1">
            {formatTpl(tStr("pages.feedback.charCount"), {
              current: message.trim().length,
              max: MAX_LEN,
              min: MIN_LEN,
            })}
          </p>
        </div>
        {error && (
          <p className="text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}
        {ok && (
          <p className="text-green-400 text-sm" role="status">
            {tStr("pages.feedback.success")}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || message.trim().length < MIN_LEN}
          className="px-4 py-2.5 rounded-lg bg-brand-500 text-dark-900 font-medium hover:bg-brand-400 disabled:opacity-50 transition touch-manipulation"
        >
          {busy ? tStr("pages.feedback.submitting") : tStr("pages.feedback.submit")}
        </button>
      </form>
    </div>
  );
}
