import type { Locale } from "@/lib/i18n/types";
import { canonicalCountryKey } from "@/lib/countrySoftRegion";
import type { SubscriptionInterval } from "@/lib/subscriptionPlans";

export type PremiumCurrency = "USD" | "EUR" | "RON";

export type PremiumDisplayMarket = {
  currency: PremiumCurrency;
  /** Simbol afișat înainte/după sumă. */
  symbol: string;
  /** Simbol înainte de sumă ($9.99) vs după (30 RON / 7,99 €). */
  symbolBefore: boolean;
  /** Separator zecimal pentru piață. */
  decimalSep: "." | ",";
  monthly: number;
  sixMonthTotal: number;
  yearTotal: number;
};

/** Prețuri doar pentru afișare (plățile nu sunt încă active pe toate piețele). */
const MARKETS: Record<PremiumCurrency, PremiumDisplayMarket> = {
  USD: {
    currency: "USD",
    symbol: "$",
    symbolBefore: true,
    decimalSep: ".",
    monthly: 9.99,
    sixMonthTotal: 49.99,
    yearTotal: 79.99,
  },
  EUR: {
    currency: "EUR",
    symbol: "€",
    symbolBefore: false,
    decimalSep: ",",
    monthly: 7.99,
    sixMonthTotal: 39.99,
    yearTotal: 59.99,
  },
  RON: {
    currency: "RON",
    symbol: "RON",
    symbolBefore: false,
    decimalSep: ",",
    monthly: 30,
    sixMonthTotal: 160,
    yearTotal: 300,
  },
};

/**
 * SUA / limba engleză → USD (evită RON/€ pentru americani din ads).
 * RO → RON; restul limbilor UE → EUR.
 */
export function resolvePremiumMarket(
  locale: Locale,
  profileCountry?: string | null
): PremiumDisplayMarket {
  const countryKey = canonicalCountryKey(profileCountry);
  if (countryKey === "us" || locale === "en") return MARKETS.USD;
  if (locale === "ro" || countryKey === "ro") return MARKETS.RON;
  return MARKETS.EUR;
}

function formatAmount(value: number, market: PremiumDisplayMarket): string {
  const whole = Number.isInteger(value);
  const raw = whole ? String(value) : value.toFixed(2);
  const withSep = market.decimalSep === "." ? raw : raw.replace(".", ",");
  if (market.symbolBefore) return `${market.symbol}${withSep}`;
  return `${withSep} ${market.symbol}`;
}

/** Sumă formată pentru interval (total perioadă, nu „pe lună” la planurile multi-lună). */
export function formatPremiumPlanPrice(
  interval: SubscriptionInterval,
  market: PremiumDisplayMarket
): string {
  if (interval === "year") return formatAmount(market.yearTotal, market);
  if (interval === "six_month") return formatAmount(market.sixMonthTotal, market);
  return formatAmount(market.monthly, market);
}
