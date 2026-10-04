"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/types";
import { SEARCH_CITY_HINTS } from "@/lib/localeSearchDefaults";

type Props = {
  country: string;
  city: string;
  locale: Locale;
  countryLabel: string;
  cityLabel: string;
  countryPlaceholder: string;
  cityPlaceholder: string;
  applyLabel: string;
  onApply: (next: { country: string; city: string }) => void;
  countryInputClassName?: string;
  cityInputClassName?: string;
};

/**
 * Țară/oraș în draft — se aplică la butonul «Caută» sau Enter.
 * Evită feed gol în timp ce userul tastează „Ge…”, „Deu…”.
 */
export function SearchLocationFields({
  country,
  city,
  locale,
  countryLabel,
  cityLabel,
  countryPlaceholder,
  cityPlaceholder,
  applyLabel,
  onApply,
  countryInputClassName = "w-36 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500",
  cityInputClassName = "w-36 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-zinc-900 text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500",
}: Props) {
  const [draftCountry, setDraftCountry] = useState(country);
  const [draftCity, setDraftCity] = useState(city);

  useEffect(() => {
    setDraftCountry(country);
    setDraftCity(city);
  }, [country, city]);

  const dirty =
    draftCountry.trim() !== country.trim() || draftCity.trim() !== city.trim();

  const apply = () => {
    onApply({ country: draftCountry.trim(), city: draftCity.trim() });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    }
  };

  const listId = `search-city-hints-${locale}`;

  return (
    <>
      <div>
        <label className="block text-xs text-dark-500 mb-1">{countryLabel}</label>
        <input
          type="text"
          placeholder={countryPlaceholder}
          value={draftCountry}
          onChange={(e) => setDraftCountry(e.target.value)}
          onKeyDown={onKeyDown}
          className={countryInputClassName}
          autoComplete="country-name"
        />
      </div>
      <div>
        <label className="block text-xs text-dark-500 mb-1">{cityLabel}</label>
        <input
          type="text"
          list={listId}
          placeholder={cityPlaceholder}
          value={draftCity}
          onChange={(e) => setDraftCity(e.target.value)}
          onKeyDown={onKeyDown}
          className={cityInputClassName}
          autoComplete="address-level2"
        />
        <datalist id={listId}>
          {SEARCH_CITY_HINTS[locale].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <button
        type="button"
        onClick={apply}
        className={`h-11 shrink-0 rounded-lg px-4 text-sm font-medium transition touch-manipulation ${
          dirty
            ? "bg-brand-500 text-white hover:bg-brand-400"
            : "border border-dark-600 bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-brand-400"
        }`}
      >
        {applyLabel}
      </button>
    </>
  );
}
