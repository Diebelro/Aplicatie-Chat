"use client";

import { useI18n } from "@/lib/i18n/context";
import { openDiebelExternal, safeDiebelUrl } from "@/lib/diebelExternalLink";

const DEFAULT_HREF = "https://ads.diebel.ro/campanie/nou";

/**
 * Promo first-party Diebel Ads — click real către Boost.
 * Texte din i18n (diebelPromo.ads*) când nu vin din Diebel Ads.
 */
export function DiebelAdsPromoCard({
  compact = false,
  title,
  body,
  cta,
  href = DEFAULT_HREF,
}: {
  compact?: boolean;
  title?: string;
  body?: string;
  cta?: string;
  href?: string;
}) {
  const { tStr } = useI18n();
  const link = safeDiebelUrl(href, DEFAULT_HREF);
  const titleText = title || tStr("diebelPromo.adsTitle");
  const bodyText = body || tStr("diebelPromo.adsBody");
  const ctaText = cta || tStr("diebelPromo.adsCta");
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openDiebelExternal(link);
      }}
      className={`block w-full cursor-pointer rounded-xl border border-amber-500/30 bg-gradient-to-br from-zinc-900 to-zinc-950 text-left text-white shadow-md shadow-black/40 transition hover:border-amber-400/50 active:scale-[0.99] ${
        compact ? "px-3 py-3" : "px-4 py-4"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">{tStr("diebelPromo.adsLabel")}</p>
      <p className={`mt-1 font-semibold ${compact ? "text-base" : "text-lg"}`}>{titleText}</p>
      <p className={`mt-1 text-white/75 ${compact ? "text-xs" : "text-sm"}`}>{bodyText}</p>
      <span className="mt-3 inline-flex rounded-full bg-amber-200 px-3 py-1.5 text-sm font-semibold text-zinc-900">
        {ctaText}
      </span>
    </a>
  );
}
