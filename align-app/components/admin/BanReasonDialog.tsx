"use client";

import { useEffect, useState } from "react";
import {
  BAN_REASON_ADMIN_LABELS,
  BAN_REASON_CODES,
  type BanReasonCode,
} from "@/lib/banReasons";

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  hint?: string;
  defaultCode?: BanReasonCode;
  onCancel: () => void;
  onConfirm: (payload: { reasonCode: BanReasonCode; reasonNote: string }) => void;
};

export function BanReasonDialog({
  open,
  title,
  confirmLabel,
  hint,
  defaultCode = "nsfw",
  onCancel,
  onConfirm,
}: Props) {
  const [code, setCode] = useState<BanReasonCode>(defaultCode);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setCode(defaultCode);
    setNote("");
    setErr("");
  }, [open, defaultCode]);

  if (!open) return null;

  const submit = () => {
    if (code === "other" && note.trim().length < 3) {
      setErr("Pentru „Alt motiv” scrie cel puțin 3 caractere. Utilizatorul vede textul.");
      return;
    }
    onConfirm({ reasonCode: code, reasonNote: note.trim() });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ban-reason-title"
        className="w-full max-w-md rounded-2xl border border-dark-600 bg-dark-800 p-4 shadow-xl"
      >
        <h2 id="ban-reason-title" className="text-base font-semibold text-zinc-900 mb-1">
          {title}
        </h2>
        <p className="text-xs text-dark-400 mb-3">
          {hint ?? "Motivul apare pe pagina „Cont blocat”. Alege una din opțiuni."}
        </p>
        <ul className="space-y-1.5 mb-3">
          {BAN_REASON_CODES.map((c) => (
            <li key={c}>
              <label className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-dark-700 cursor-pointer">
                <input
                  type="radio"
                  name="ban-reason"
                  className="mt-1"
                  checked={code === c}
                  onChange={() => setCode(c)}
                />
                <span className="text-sm text-zinc-900">{BAN_REASON_ADMIN_LABELS[c]}</span>
              </label>
            </li>
          ))}
        </ul>
        {code === "other" ? (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="Ex: a cerut bani în chat, a postat link de OnlyFans…"
            className="w-full mb-3 rounded-lg border border-dark-600 bg-dark-700 px-3 py-2 text-sm text-zinc-900 placeholder-dark-500"
          />
        ) : null}
        {err ? <p className="text-red-400 text-xs mb-2">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-lg border border-dark-600 text-sm text-dark-300 hover:bg-dark-700"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={submit}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
