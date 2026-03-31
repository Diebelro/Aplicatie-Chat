"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/authClient";
import { clearFeedbackDraft, readFeedbackDraft, writeFeedbackDraft } from "@/lib/formDrafts";

export default function AppFeedbackPage() {
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
        setError(typeof data.error === "string" ? data.error : "Nu s-a putut trimite.");
        return;
      }
      setOk(true);
      setMessage("");
      clearFeedbackDraft();
    } catch {
      setError("Eroare de rețea.");
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
          ← Setări cont
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900">Propuneri și feedback</h1>
      </div>

      <p className="text-dark-400 text-sm leading-relaxed">
        Spune-ne ce ai vreo idee ca să îmbunătățim aplicația sau dacă ceva nu merge cum trebuie (ecran, mesaje,
        apeluri etc.). Citim mesajele și folosim feedback-ul pentru prioritate la remedieri. Textul rămâne salvat pe{" "}
        <strong className="text-dark-300">acest tab</strong> dacă pleci și revii (nu și după ce închizi tab-ul).
      </p>

      <form onSubmit={(e) => void submit(e)} className="p-6 rounded-2xl bg-dark-800 border border-dark-600 space-y-4">
        <div>
          <label htmlFor="feedback-msg" className="block text-dark-500 text-sm mb-2">
            Mesajul tău
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
            placeholder="Ex.: Pe telefon, în chat, nu văd câmpul de scris până nu dau scroll… / Aș vrea un filtru pentru…"
            maxLength={8000}
            disabled={busy}
          />
          <p className="text-dark-600 text-xs mt-1">{message.trim().length} / 8000 · minim 8 caractere</p>
        </div>
        {error && (
          <p className="text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}
        {ok && (
          <p className="text-green-400 text-sm" role="status">
            Mulțumim! Mesajul a fost trimis.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || message.trim().length < 8}
          className="px-4 py-2.5 rounded-lg bg-brand-500 text-dark-900 font-medium hover:bg-brand-400 disabled:opacity-50 transition touch-manipulation"
        >
          {busy ? "Se trimite…" : "Trimite"}
        </button>
      </form>
    </div>
  );
}
