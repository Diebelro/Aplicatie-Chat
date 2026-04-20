"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { performClientLogout, performClientLogoutAllDevices } from "@/lib/clientLogout";

type Step = "choose" | "confirmAll";

export function LogoutChoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tStr } = useI18n();
  const [step, setStep] = useState<Step>("choose");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("choose");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === "choose" ? "logout-dialog-title" : "logout-dialog-confirm-title"}
        className="bg-dark-800 border border-dark-600 rounded-2xl p-6 max-w-md w-full shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {step === "choose" ? (
          <>
            <h2 id="logout-dialog-title" className="text-lg font-semibold text-zinc-900 mb-1">
              {tStr("logoutDialog.title")}
            </h2>
            <p className="text-dark-500 text-sm mb-5">{tStr("logoutDialog.intro")}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(performClientLogout)}
                className="w-full px-4 py-3 rounded-xl border border-dark-600 bg-dark-700 text-zinc-900 font-medium text-sm hover:bg-dark-600 transition disabled:opacity-50 text-left"
              >
                <span className="block">{tStr("logoutDialog.thisDevice")}</span>
                <span className="block text-xs font-normal text-dark-500 mt-0.5">{tStr("logoutDialog.thisDeviceHint")}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep("confirmAll")}
                className="w-full px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 font-medium text-sm hover:bg-red-500/15 transition disabled:opacity-50 text-left"
              >
                <span className="block">{tStr("logoutDialog.allDevices")}</span>
                <span className="block text-xs font-normal text-red-600/90 mt-0.5">{tStr("logoutDialog.allDevicesHint")}</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-dark-600 text-sm font-medium text-dark-500 hover:bg-dark-700 transition"
              >
                {tStr("logoutDialog.cancel")}
              </button>
            </div>
            {busy && <p className="text-dark-500 text-xs mt-3">{tStr("logoutDialog.busy")}</p>}
          </>
        ) : (
          <>
            <h2 id="logout-dialog-confirm-title" className="text-lg font-semibold text-zinc-900 mb-2">
              {tStr("logoutDialog.confirmAllTitle")}
            </h2>
            <p className="text-dark-500 text-sm mb-5">{tStr("logoutDialog.confirmAllBody")}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep("choose")}
                className="flex-1 px-4 py-2.5 rounded-xl bg-dark-600 text-zinc-900 hover:bg-dark-500 transition text-sm font-medium disabled:opacity-50"
              >
                {tStr("logoutDialog.back")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(performClientLogoutAllDevices)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition text-sm font-medium disabled:opacity-50"
              >
                {busy ? tStr("logoutDialog.busy") : tStr("logoutDialog.confirmAllBtn")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
