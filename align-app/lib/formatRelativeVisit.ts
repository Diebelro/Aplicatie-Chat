import type { Locale } from "@/lib/i18n/types";
import { intlLocaleTag } from "@/lib/i18n/intlLocale";

/** Timp relativ în trecut pentru subtitlul „te-a vizitat …”. */
export function formatRelativePast(iso: string, locale: Locale): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const tag = intlLocaleTag(locale);
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  if (diffSec < 45) return rtf.format(0, "second");
  if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), "minute");
  if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), "hour");
  if (diffSec < 86400 * 7) return rtf.format(-Math.floor(diffSec / 86400), "day");
  if (diffSec < 86400 * 30) return rtf.format(-Math.floor(diffSec / (86400 * 7)), "week");
  if (diffSec < 86400 * 365) return rtf.format(-Math.floor(diffSec / (86400 * 30)), "month");
  return rtf.format(-Math.floor(diffSec / (86400 * 365)), "year");
}
