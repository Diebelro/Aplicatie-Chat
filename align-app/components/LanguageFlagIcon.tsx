"use client";

import type { Locale } from "@/lib/i18n/types";

/** Doar steag SVG, fără bordură sau casetă — numai culorile steagului. */
export function LanguageFlagIcon({
  locale,
  compact,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const sz = compact ? "w-[1.2rem] h-[0.8rem]" : "w-7 h-[1.15rem]";
  const cls = `${sz} block shrink-0 overflow-hidden rounded-[2px]`;

  if (locale === "ro") {
    return (
      <svg className={cls} viewBox="0 0 9 6" aria-hidden="true" focusable="false">
        <rect width="3" height="6" fill="#002B7F" />
        <rect x="3" width="3" height="6" fill="#FCD116" />
        <rect x="6" width="3" height="6" fill="#CE1126" />
      </svg>
    );
  }
  if (locale === "de") {
    return (
      <svg className={cls} viewBox="0 0 9 6" aria-hidden="true" focusable="false">
        <rect width="9" height="2" fill="#000" />
        <rect y="2" width="9" height="2" fill="#DD0000" />
        <rect y="4" width="9" height="2" fill="#FFCE00" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 640 480" aria-hidden="true" focusable="false">
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#FFF"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z"
      />
      <path
        fill="#C8102E"
        d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"
      />
      <path fill="#FFF" d="M241 0v480h160V0zM0 160v160h640V160z" />
      <path fill="#C8102E" d="M0 193v96h640v-96zM273 0v480h96V0z" />
    </svg>
  );
}
