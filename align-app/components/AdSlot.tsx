"use client";

import { useEffect, useState } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useI18n } from "@/lib/i18n/context";
import { OptimizedImage } from "@/components/OptimizedImage";
import { DiebelAdsPromoCard } from "@/components/DiebelAdsPromoCard";
import { openDiebelExternal, safeDiebelUrl } from "@/lib/diebelExternalLink";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";

function isPremiumUser(user: User): boolean {
  if (user.premium_permanent) return true;
  const until = user.premium_until;
  if (until != null && typeof until === "number" && Date.now() < until) return true;
  return false;
}

export type AdSlotVariant = "banner" | "rectangle" | "strip" | "discrete" | "native" | "interstitial";

interface AdSlotProps {
  variant?: AdSlotVariant;
  /** Ascunde reclama daca userul are Premium (implicit true) */
  hideIfPremium?: boolean;
  /** Afiseaza doar daca consent marketing (implicit true) */
  requireMarketingConsent?: boolean;
}

const GOOGLE_ADS_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "ca-pub-XXXXXXXXXX";
const AD_SLOT_IDS: Record<string, string> = {
  banner: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER || "",
  rectangle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE || "",
  strip: process.env.NEXT_PUBLIC_ADSENSE_SLOT_STRIP || "",
  discrete: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DISCRETE || "",
  native: process.env.NEXT_PUBLIC_ADSENSE_SLOT_NATIVE || "",
  interstitial: process.env.NEXT_PUBLIC_ADSENSE_SLOT_INTERSTITIAL || "",
};

function useIsPremium(): boolean {
  const [premium, setPremium] = useState(false);
  useEffect(() => {
    const raw = getStoredUserRaw();
    if (!raw) {
      setPremium(false);
      return;
    }
    try {
      const u = JSON.parse(raw) as User;
      setPremium(isPremiumUser(u));
    } catch {
      setPremium(false);
    }
  }, []);
  return premium;
}

export default function AdSlot({
  variant = "banner",
  hideIfPremium = true,
  requireMarketingConsent = true,
}: AdSlotProps) {
  const { consent } = useCookieConsent();
  const { locale, tStr } = useI18n();
  const userPremium = useIsPremium();
  const [directAd, setDirectAd] = useState<{ imageUrl?: string; link?: string; alt?: string } | null>(null);
  const [diebelAd, setDiebelAd] = useState<{ title: string; body: string; cta: string; click: string; city: string; image?: string | null } | null>(null);

  const clientOk =
    GOOGLE_ADS_CLIENT.startsWith("ca-pub-") && !GOOGLE_ADS_CLIENT.includes("XXXX");
  const slotId = AD_SLOT_IDS[variant] ?? "";
  const marketingOk = !requireMarketingConsent || consent?.marketing === true;
  const useAdSense = marketingOk && clientOk && !!slotId;

  useEffect(() => {
    if (variant && marketingOk) {
      fetch(`/api/ads/direct?slot=${variant}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.imageUrl || d.link) setDirectAd({ imageUrl: d.imageUrl, link: d.link, alt: d.alt });
        })
        .catch(() => {});
    }
  }, [variant, marketingOk]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ads/diebel?slot=${encodeURIComponent(variant)}&lang=${encodeURIComponent(locale)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("diebel ads unavailable");
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error("diebel ads not json");
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (d.ad?.title && d.ad?.click) {
          setDiebelAd({
            title: d.ad.title,
            body: d.ad.body,
            cta: d.ad.cta,
            click: safeDiebelUrl(d.ad.click),
            city: d.ad.city || "Diebel",
            image: d.ad.image || null,
          });
        } else {
          setDiebelAd(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiebelAd({
            title: tStr("diebelPromo.adsTitle"),
            body: tStr("diebelPromo.adsBody"),
            cta: tStr("diebelPromo.adsCta"),
            click: "https://ads.diebel.ro/campanie/nou",
            city: "Diebel",
            image: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [variant, locale, tStr]);

  useEffect(() => {
    if (!useAdSense) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* AdSense încă se încarcă */
    }
  }, [useAdSense, variant, slotId]);

  if (hideIfPremium && userPremium) return null;
  // First-party Diebel Ads / Boost rămâne vizibil fără consent marketing.
  if (!diebelAd && requireMarketingConsent && consent !== null && !consent.marketing && variant !== "strip") {
    return null;
  }

  if (variant === "strip") {
    return (
      <div className="w-full flex justify-center py-2 px-1">
        <div className="w-full max-w-lg">
          <DiebelAdsPromoCard
            title={diebelAd?.title}
            body={diebelAd?.body}
            cta={diebelAd?.cta}
            href={diebelAd?.click || "https://ads.diebel.ro/campanie/nou"}
          />
        </div>
      </div>
    );
  }

  const isDiscrete = variant === "discrete";
  const isNative = variant === "native";
  const isInterstitial = variant === "interstitial";
  const size =
    variant === "rectangle"
      ? { width: 300, height: 250 }
      : isDiscrete
        ? { width: "100%", height: 28 }
        : isNative
          ? { width: "100%", height: 90 }
          : isInterstitial
            ? { width: "100%", height: 400 }
            : { width: 320, height: 50 };

  if (!useAdSense && !directAd?.imageUrl && !diebelAd) return null;

  return (
    <div
      className={`w-full flex justify-center ${isDiscrete ? "py-0.5" : isInterstitial ? "py-0" : "py-2"}`}
    >
      <div
        className={
          isDiscrete
            ? "w-full rounded overflow-hidden flex items-center justify-center bg-dark-800/50 border border-dark-600/50"
            : isInterstitial
              ? "w-full min-h-[400px] rounded-xl overflow-hidden flex items-center justify-center bg-dark-800 border border-dark-600"
              : isNative
                ? "w-full rounded-lg overflow-hidden flex items-center justify-center bg-dark-700/60 border border-dark-600"
                : "bg-dark-700/80 border border-dark-600 rounded-xl overflow-hidden flex items-center justify-center"
        }
        style={{
          minWidth: typeof size.width === "number" ? size.width : undefined,
          width: typeof size.width === "string" ? size.width : undefined,
          minHeight: size.height,
        }}
      >
        {diebelAd ? (
          diebelAd.image ? (
            <a
              href={diebelAd.click}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openDiebelExternal(diebelAd.click);
              }}
              className="block w-full cursor-pointer text-left text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={diebelAd.image} alt="" className="h-36 w-full object-cover" />
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/60">{diebelAd.city && diebelAd.city !== "Diebel" ? `${tStr("diebelPromo.adsLabel")} · ${diebelAd.city}` : tStr("diebelPromo.adsLabel")}</p>
                <p className="mt-1 font-semibold">{diebelAd.title}</p>
                <p className="mt-1 text-sm text-white/80">{diebelAd.body}</p>
                <p className="mt-2 text-sm font-semibold text-rose-300">{diebelAd.cta}</p>
              </div>
            </a>
          ) : (
            <div className="w-full p-2">
              <DiebelAdsPromoCard
                title={diebelAd.title}
                body={diebelAd.body}
                cta={diebelAd.cta}
                href={diebelAd.click}
              />
            </div>
          )
        ) : useAdSense ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block", minHeight: size.height, width: "100%" }}
            data-ad-client={GOOGLE_ADS_CLIENT}
            data-ad-slot={slotId}
            data-ad-format={
              variant === "rectangle" ? "rectangle" : variant === "native" ? "fluid" : "auto"
            }
            data-full-width-responsive="true"
          />
        ) : directAd?.imageUrl ? (
          <a
            href={directAd.link || "#"}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block relative w-full h-full min-h-[50px]"
          >
            <OptimizedImage
              src={directAd.imageUrl}
              alt={directAd.alt || "Reclama"}
              fill
              sizes="(max-width: 768px) 100vw, 336px"
              className="object-contain"
            />
          </a>
        ) : null}
      </div>
    </div>
  );
}
