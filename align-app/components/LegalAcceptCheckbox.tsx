"use client";

import Link from "next/link";

type LegalAcceptCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  lead: string;
  rulesLabel: string;
  mid: string;
  termsLabel: string;
  between: string;
  privacyLabel: string;
  andLabel: string;
  cookiesLabel: string;
  end: string;
};

/**
 * O singură bifă legală la înregistrare: 18+, reguli, termeni, confidențialitate, cookie-uri.
 * Zonă de atingere ≥ 44px; text lizibil; fără suprapuneri cu alte elemente.
 */
export function LegalAcceptCheckbox({
  checked,
  onChange,
  lead,
  rulesLabel,
  mid,
  termsLabel,
  between,
  privacyLabel,
  andLabel,
  cookiesLabel,
  end,
}: LegalAcceptCheckboxProps) {
  return (
    <div className="rounded-xl border border-dark-600/80 bg-dark-800/40 px-3 py-3">
      <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-[1.125rem] h-[1.125rem] shrink-0 rounded border-dark-500 bg-dark-800 text-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-0"
        />
        <span className="text-dark-400 text-sm leading-relaxed">
          {lead}
          <Link href="/community-rules" className="text-brand-400 hover:text-brand-300 hover:underline font-medium">
            {rulesLabel}
          </Link>
          {mid}
          <Link href="/terms" className="text-brand-400 hover:text-brand-300 hover:underline font-medium">
            {termsLabel}
          </Link>
          {between}
          <Link href="/privacy" className="text-brand-400 hover:text-brand-300 hover:underline font-medium">
            {privacyLabel}
          </Link>
          {andLabel}
          <Link href="/cookies" className="text-brand-400 hover:text-brand-300 hover:underline font-medium">
            {cookiesLabel}
          </Link>
          {end}
        </span>
      </label>
    </div>
  );
}
