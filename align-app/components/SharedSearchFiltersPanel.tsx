"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Locale } from "@/lib/i18n/types";
import { SEARCH_CITY_HINTS } from "@/lib/localeSearchDefaults";
import { MAX_PROFILE_SEARCH_RADIUS_KM } from "@/lib/profileSearchConstants";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { getStoredUserRaw } from "@/lib/store";
import {
  hasActiveSearchFilters,
  broadenSearchFilters,
  type SearchFilters,
} from "@/lib/useSearchFilters";

type Props = {
  filters: SearchFilters;
  onApply: (next: SearchFilters) => void;
  locale: Locale;
  tStr: (path: string) => string;
  /** Pe Profile: sortare listă */
  showSortBy?: boolean;
  /** Golește filtrele restrictive (țară, oraș, distanță…) — „Arată toți utilizatorii”. */
  onReset?: () => void;
  /** Apelat imediat când utilizatorul schimbă țară/oraș/nume — UI golește rezultatele vechi (fără lag). */
  onFilterPending?: () => void;
};

type FieldKey = "minAge" | "maxAge" | "country";

type FieldErrors = Partial<Record<FieldKey, true>>;

function inputClass(base: string, hasError?: boolean): string {
  if (!hasError) return base;
  return base
    .replace("border-dark-600", "border-red-400/70")
    .replace("focus:ring-brand-500", "focus:ring-red-400/50");
}

function normalizeValidated(draft: SearchFilters): SearchFilters | null {
  const minRaw = draft.minAge.trim();
  const maxRaw = draft.maxAge.trim();
  const country = draft.country.trim();
  const city = draft.city.trim();

  if (!minRaw || !maxRaw) return null;

  const minNum = Number(minRaw);
  const maxNum = Number(maxRaw);
  if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return null;
  if (minNum < 18 || minNum > 100 || maxNum < 18 || maxNum > 100) return null;
  if (city && !country) return null;

  return {
    ...draft,
    minAge: String(Math.min(minNum, maxNum)),
    maxAge: String(Math.max(minNum, maxNum)),
    country,
    city,
    name: draft.name.trim(),
  };
}

function readMyGender(): string {
  try {
    const raw = getStoredUserRaw();
    if (!raw) return "";
    const g = String((JSON.parse(raw) as { gender?: string }).gender ?? "").toLowerCase();
    return g === "male" || g === "female" || g === "other" ? g : "";
  } catch {
    return "";
  }
}

function oppositeSeekingGender(myGender: string): string {
  if (myGender === "male") return "female";
  if (myGender === "female") return "male";
  return "";
}

function orderedGenderOptions(
  preferred: string,
  tStr: (path: string) => string
): { value: string; label: string }[] {
  const all = [
    { value: "female", label: tStr("pages.discover.genderFemale") },
    { value: "male", label: tStr("pages.discover.genderMale") },
    { value: "", label: tStr("pages.discover.genderAll") },
    { value: "other", label: tStr("pages.discover.genderOther") },
  ];
  if (!preferred) return all;
  const first = all.find((o) => o.value === preferred);
  const rest = all.filter((o) => o.value !== preferred);
  return first ? [first, ...rest] : all;
}

/**
 * Panou căutare shared (Descoperă + Profile).
 * Toate câmpurile vizibile; layout pe grid pentru telefon / tabletă / desktop.
 * Gen / online / sort / distanță: instant; text / vârstă / locație: debounce.
 */
export function SharedSearchFiltersPanel({
  filters,
  onApply,
  locale,
  tStr,
  showSortBy = false,
  onReset,
  onFilterPending,
}: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validationMsg, setValidationMsg] = useState("");
  const [genderOpen, setGenderOpen] = useState(false);
  const genderMenuRef = useRef<HTMLDivElement>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const onFilterPendingRef = useRef(onFilterPending);
  onFilterPendingRef.current = onFilterPending;
  const skipNextDebounce = useRef(true);
  const distanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markPending = () => {
    onFilterPendingRef.current?.();
  };

  useEffect(() => {
    setDraft(filters);
    setErrors({});
    setValidationMsg("");
    skipNextDebounce.current = true;
  }, [filters]);

  const canSearchAll = hasActiveSearchFilters(draft) || hasActiveSearchFilters(filters);

  const clearFieldError = (key: FieldKey) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setValidationMsg("");
  };

  const showValidationHints = (d: SearchFilters) => {
    const nextErrors: FieldErrors = {};
    const missing: string[] = [];
    const minRaw = d.minAge.trim();
    const maxRaw = d.maxAge.trim();
    const minNum = Number(minRaw);
    const maxNum = Number(maxRaw);

    if (minRaw && (!Number.isFinite(minNum) || minNum < 18 || minNum > 100)) {
      nextErrors.minAge = true;
      missing.push(tStr("pages.discover.filterFieldMinAge"));
    }
    if (maxRaw && (!Number.isFinite(maxNum) || maxNum < 18 || maxNum > 100)) {
      nextErrors.maxAge = true;
      missing.push(tStr("pages.discover.filterFieldMaxAge"));
    }
    const country = d.country.trim();
    const city = d.city.trim();
    if (city && !country) {
      nextErrors.country = true;
      missing.push(tStr("pages.discover.filterFieldCountryForCity"));
    }
    setErrors(nextErrors);
    if (missing.length) {
      setValidationMsg(
        formatTpl(tStr("pages.discover.filterNeedsAttention"), {
          fields: [...new Set(missing)].join(", "),
        })
      );
    } else {
      setValidationMsg("");
    }
  };

  const commitInstant = (nextDraft: SearchFilters) => {
    setDraft(nextDraft);
    const validated = normalizeValidated(nextDraft);
    if (!validated) {
      showValidationHints(nextDraft);
      return;
    }
    setErrors({});
    setValidationMsg("");
    if (JSON.stringify(validated) !== JSON.stringify(filters)) {
      // Pending doar când urmează fetch — altfel loading rămâne agățat (select nativ / același gen).
      markPending();
      onApplyRef.current(validated);
    }
  };

  useEffect(() => {
    if (!genderOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!genderMenuRef.current?.contains(e.target as Node)) setGenderOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [genderOpen]);

  useEffect(() => {
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return;
    }
    const t = setTimeout(() => {
      const validated = normalizeValidated(draft);
      if (!validated) {
        showValidationHints(draft);
        return;
      }
      setErrors({});
      setValidationMsg("");
      if (JSON.stringify(validated) !== JSON.stringify(filters)) {
        markPending();
        onApplyRef.current(validated);
      }
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: draft-driven debounce
  }, [draft.name, draft.minAge, draft.maxAge, draft.country, draft.city]);

  const searchAllUsers = () => {
    const open = broadenSearchFilters({ ...draft, sortBy: draft.sortBy || filters.sortBy });
    setDraft(open);
    setErrors({});
    setValidationMsg("");
    skipNextDebounce.current = true;
    markPending();
    if (onReset) {
      onReset();
    } else {
      onApply(open);
    }
  };

  const listId = `shared-search-city-hints-${locale}`;
  const field =
    "w-full min-h-11 bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-zinc-900 text-base sm:text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500 touch-manipulation";
  const labelCls = "block text-xs text-dark-500 mb-1";
  const myGender = readMyGender();
  const preferredGender = oppositeSeekingGender(myGender);
  const genderOptions = orderedGenderOptions(preferredGender, tStr);

  const distKm = Math.min(
    MAX_PROFILE_SEARCH_RADIUS_KM,
    Math.max(0, Number(draft.maxDistanceKm) || 0)
  );

  return (
    <div className="app-pro-panel w-full mb-3 p-3 sm:p-4">
      {validationMsg ? (
        <p className="text-xs text-red-500/90 mb-2" role="alert">
          {validationMsg}
        </p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-3 items-end">
        {/* Nume — full pe mobil */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <label className={labelCls} htmlFor="search-name">
            {tStr("pages.discover.nameLabel")}
          </label>
          <input
            id="search-name"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={tStr("pages.discover.searchPlaceholder")}
            value={draft.name}
            onChange={(e) => {
              setDraft((d) => ({ ...d, name: e.target.value }));
            }}
            className={field}
          />
        </div>

        {/* Gen — un singur câmp; meniul se deschide la tap (nu 4 butoane care rup layout-ul) */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-1" ref={genderMenuRef}>
          <span className={labelCls} id="search-gender-label">
            {tStr("pages.discover.genderLabel")}
          </span>
          <div className="relative">
            <button
              type="button"
              id="search-gender"
              aria-labelledby="search-gender-label"
              aria-haspopup="listbox"
              aria-expanded={genderOpen}
              onClick={() => setGenderOpen((o) => !o)}
              className={`${field} flex items-center justify-between gap-1 text-left`}
            >
              <span className="truncate">
                {genderOptions.find((o) => o.value === draft.gender)?.label ??
                  tStr("pages.discover.genderAll")}
              </span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-dark-400 transition-transform ${genderOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {genderOpen ? (
              <ul
                role="listbox"
                className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-dark-600 bg-dark-800 shadow-lg overflow-hidden"
              >
                {genderOptions.map((opt) => {
                  const active = draft.gender === opt.value;
                  return (
                    <li key={opt.value || "all"} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setGenderOpen(false);
                          commitInstant({ ...draft, gender: opt.value, genderLocked: true });
                        }}
                        className={[
                          "w-full text-left px-3 py-2.5 text-sm touch-manipulation",
                          active
                            ? "bg-brand-500/15 text-brand-700 font-medium"
                            : "text-zinc-900 hover:bg-dark-700",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        {/* Online */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-1 flex items-end">
          <label className="flex items-center gap-2 min-h-11 w-full cursor-pointer rounded-xl border border-dark-600 bg-dark-700 px-3 touch-manipulation">
            <input
              type="checkbox"
              checked={draft.onlineOnly}
              onChange={(e) => commitInstant({ ...draft, onlineOnly: e.target.checked })}
              className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
            />
            <span className="text-sm text-dark-300 leading-tight">{tStr("pages.discover.onlineOnly")}</span>
          </label>
        </div>

        {/* Vârstă min / max */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-1">
          <label
            className={`${labelCls} ${errors.minAge ? "text-red-500/90" : ""}`}
            htmlFor="search-min-age"
          >
            {tStr("pages.discover.minAge")}
          </label>
          <input
            id="search-min-age"
            type="number"
            inputMode="numeric"
            min={18}
            max={100}
            placeholder="18"
            value={draft.minAge}
            onChange={(e) => {
              clearFieldError("minAge");
              setDraft((d) => ({ ...d, minAge: e.target.value }));
            }}
            className={inputClass(field, errors.minAge)}
            aria-invalid={errors.minAge ? true : undefined}
          />
        </div>
        <div className="col-span-1 sm:col-span-1 lg:col-span-1">
          <label
            className={`${labelCls} ${errors.maxAge ? "text-red-500/90" : ""}`}
            htmlFor="search-max-age"
          >
            {tStr("pages.discover.maxAge")}
          </label>
          <input
            id="search-max-age"
            type="number"
            inputMode="numeric"
            min={18}
            max={100}
            placeholder="100"
            value={draft.maxAge}
            onChange={(e) => {
              clearFieldError("maxAge");
              setDraft((d) => ({ ...d, maxAge: e.target.value }));
            }}
            className={inputClass(field, errors.maxAge)}
            aria-invalid={errors.maxAge ? true : undefined}
          />
        </div>

        {/* Țară / oraș */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label
            className={`${labelCls} ${errors.country ? "text-red-500/90" : ""}`}
            htmlFor="search-country"
          >
            {tStr("pages.discover.countryLabel")}
          </label>
          <input
            id="search-country"
            type="text"
            placeholder={tStr("pages.discover.countryPlaceholder")}
            value={draft.country}
            onChange={(e) => {
              clearFieldError("country");
              setDraft((d) => ({ ...d, country: e.target.value }));
            }}
            className={inputClass(field, errors.country)}
            autoComplete="country-name"
            aria-invalid={errors.country ? true : undefined}
          />
        </div>
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <label className={labelCls} htmlFor="search-city">
            {tStr("pages.discover.cityLabel")}
          </label>
          <input
            id="search-city"
            type="text"
            list={listId}
            placeholder={tStr("pages.discover.cityPlaceholder")}
            value={draft.city}
            onChange={(e) => {
              clearFieldError("country");
              setDraft((d) => ({ ...d, city: e.target.value }));
            }}
            className={field}
            autoComplete="address-level2"
          />
          <datalist id={listId}>
            {SEARCH_CITY_HINTS[locale].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Distanță — full width pe mobil */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <label className={labelCls} htmlFor="search-distance">
            {tStr("pages.discover.maxDistKm")}
            {distKm > 0 ? <span className="tabular-nums text-dark-400"> · {distKm} km</span> : null}
          </label>
          <div className="min-h-11 flex items-center px-1">
            <input
              id="search-distance"
              type="range"
              min={0}
              max={MAX_PROFILE_SEARCH_RADIUS_KM}
              step={MAX_PROFILE_SEARCH_RADIUS_KM > 250 ? 5 : 1}
              value={distKm}
              onChange={(e) => {
                const maxDistanceKm = e.target.value;
                setDraft((d) => ({ ...d, maxDistanceKm }));
                if (distanceTimerRef.current) clearTimeout(distanceTimerRef.current);
                distanceTimerRef.current = setTimeout(() => {
                  commitInstant({ ...draft, maxDistanceKm });
                }, 120);
              }}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-dark-600 accent-brand-500 touch-manipulation"
            />
          </div>
        </div>

        {showSortBy ? (
          <div className="col-span-2 sm:col-span-2 lg:col-span-2">
            <label className={labelCls} htmlFor="search-sort">
              {tStr("pages.profiles.sortLabel")}
            </label>
            <select
              id="search-sort"
              value={draft.sortBy}
              onChange={(e) => commitInstant({ ...draft, sortBy: e.target.value })}
              className={field}
            >
              <option value="online">{tStr("pages.profiles.sortOnline")}</option>
              <option value="recommended">{tStr("pages.profiles.sortRecommended")}</option>
              <option value="distance">{tStr("pages.profiles.sortDistance")}</option>
            </select>
          </div>
        ) : null}

        {canSearchAll ? (
          <div className="col-span-2 sm:col-span-2 lg:col-span-2 flex items-end">
            <button
              type="button"
              onClick={searchAllUsers}
              className="w-full min-h-11 rounded-xl border border-dark-600 bg-dark-700 px-3 text-sm text-dark-300 hover:bg-dark-600 touch-manipulation"
            >
              {tStr("pages.discover.showAllUsers")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
