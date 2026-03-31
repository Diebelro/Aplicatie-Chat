"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useCookieConsent, type CookieConsentState } from "@/contexts/CookieConsentContext";

interface CookieConsentModalProps {
  onClose: () => void;
  onSave?: () => void;
}

export function CookieConsentModal({ onClose, onSave }: CookieConsentModalProps) {
  const { t } = useI18n();
  const { consent, setConsent, loadConsent } = useCookieConsent();
  const get = (key: string) => t(`cookieConsent.${key}`) as string;
  const getCommon = (key: string) => t(`common.buttons.${key}`) as string;

  const [form, setForm] = useState<CookieConsentState>({
    necessary: true,
    functional: consent?.functional ?? false,
    statistics: consent?.statistics ?? false,
    marketing: consent?.marketing ?? false,
  });

  useEffect(() => {
    if (consent) {
      setForm({
        necessary: true,
        functional: consent.functional,
        statistics: consent.statistics,
        marketing: consent.marketing,
      });
    }
  }, [consent]);

  const handleSave = () => {
    setConsent(form);
    loadConsent();
    onSave?.();
    onClose();
  };

  const acceptAllAndSave = () => {
    setConsent({
      necessary: true,
      functional: true,
      statistics: true,
      marketing: true,
    });
    loadConsent();
    onSave?.();
    onClose();
  };

  const acceptAllLabel = get("accept");

  return (
    <div
      className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-dark-800 border border-dark-600 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 id="cookie-modal-title" className="text-lg font-semibold text-zinc-900 mb-4">
            {get("preferences")}
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-900/50">
              <input
                type="checkbox"
                id="necessary"
                checked={form.necessary}
                disabled
                className="mt-1 w-4 h-4 rounded border-dark-500 bg-dark-700 text-brand-500"
              />
              <div>
                <label htmlFor="necessary" className="font-medium text-zinc-900">
                  {get("necessary")}
                </label>
                <p className="text-sm text-dark-400 mt-0.5">{get("necessaryDesc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-900/50">
              <input
                type="checkbox"
                id="statistics"
                checked={form.statistics}
                onChange={(e) => setForm((f) => ({ ...f, statistics: e.target.checked }))}
                className="mt-1 w-4 h-4 rounded border-dark-500 bg-dark-700 text-brand-500"
              />
              <div>
                <label htmlFor="statistics" className="font-medium text-zinc-900">
                  {get("statistics")}
                </label>
                <p className="text-sm text-dark-400 mt-0.5">{get("statisticsDesc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-900/50">
              <input
                type="checkbox"
                id="marketing"
                checked={form.marketing}
                onChange={(e) => setForm((f) => ({ ...f, marketing: e.target.checked }))}
                className="mt-1 w-4 h-4 rounded border-dark-500 bg-dark-700 text-brand-500"
              />
              <div>
                <label htmlFor="marketing" className="font-medium text-zinc-900">
                  {get("marketing")}
                </label>
                <p className="text-sm text-dark-400 mt-0.5">{get("marketingDesc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-dark-900/50">
              <input
                type="checkbox"
                id="functional"
                checked={form.functional}
                onChange={(e) => setForm((f) => ({ ...f, functional: e.target.checked }))}
                className="mt-1 w-4 h-4 rounded border-dark-500 bg-dark-700 text-brand-500"
              />
              <div>
                <label htmlFor="functional" className="font-medium text-zinc-900">
                  {get("functional")}
                </label>
                <p className="text-sm text-dark-400 mt-0.5">{get("functionalDesc")}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              type="button"
              onClick={acceptAllAndSave}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
            >
              {acceptAllLabel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition"
            >
              {getCommon("save")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-dark-600 text-zinc-600 hover:bg-dark-700 font-medium text-sm transition"
            >
              {getCommon("cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
