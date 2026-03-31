"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { LOCALES } from "@/lib/i18n/types";
import { LanguageFlagIcon } from "@/components/LanguageFlagIcon";

const ARIA_PATH: Record<Locale, string> = {
  ro: "common.labels.langPickRo",
  en: "common.labels.langPickEn",
  de: "common.labels.langPickDe",
};

/** Doar steagul — buton invizibil, fără casetă / umbră / chenar în jur. */
const bareBtn =
  "m-0 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/55 focus-visible:ring-offset-0";

export function LanguageSwitcher({
  compact = false,
  openMenuBelow = false,
  className = "",
}: {
  compact?: boolean;
  openMenuBelow?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const { locale, setLocale, tStr } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (pathname?.startsWith("/admin")) return null;

  const menuPosition = openMenuBelow
    ? "top-full left-1/2 -translate-x-1/2 mt-1.5"
    : "bottom-full left-1/2 -translate-x-1/2 mb-1.5";

  const others = LOCALES.filter((loc) => loc !== locale);

  return (
    <div ref={rootRef} className={`relative inline-flex shrink-0 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={bareBtn}
        aria-label={`${tStr("common.labels.language")}: ${tStr(ARIA_PATH[locale])}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <LanguageFlagIcon locale={locale} compact={compact} />
      </button>
      {open && others.length > 0 && (
        <ul
          className={`absolute ${menuPosition} z-[100] flex flex-col items-center gap-2 p-0`}
          role="listbox"
          aria-label={tStr("common.labels.language")}
        >
          {others.map((loc) => (
            <li key={loc} role="none" className="list-none m-0 p-0">
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={bareBtn}
                aria-label={tStr(ARIA_PATH[loc])}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
              >
                <LanguageFlagIcon locale={loc} compact={compact} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
