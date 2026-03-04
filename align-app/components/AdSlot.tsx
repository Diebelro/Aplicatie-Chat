"use client";

import { useEffect, useState } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
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
  const userPremium = useIsPremium();
  const [directAd, setDirectAd] = useState<{ imageUrl?: string; link?: string; alt?: string } | null>(null);

  useEffect(() => {
    if (variant && (consent?.marketing || !requireMarketingConsent)) {
      fetch(`/api/ads/direct?slot=${variant}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.imageUrl || d.link) setDirectAd({ imageUrl: d.imageUrl, link: d.link, alt: d.alt });
        })
        .catch(() => {});
    }
  }, [variant, consent?.marketing, requireMarketingConsent]);


  if (hideIfPremium && userPremium) return null;
  if (requireMarketingConsent && consent !== null && !consent.marketing) {
    return (
      <div className="w-full flex justify-center py-2">
        <div className="bg-dark-800/50 border border-dark-600 rounded-xl px-4 py-3 text-center">
          <p className="text-dark-500 text-xs">
            Activeaza reclamele in <a href="/cookies" className="text-brand-400 hover:underline">Setari cookies</a> pentru a vedea continut aici.
          </p>
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
      : variant === "strip"
        ? { width: "100%", height: 120 }
        : isDiscrete
          ? { width: "100%", height: 28 }
          : isNative
            ? { width: "100%", height: 90 }
            : isInterstitial
              ? { width: "100%", height: 400 }
              : { width: 320, height: 50 };

  const slotId = AD_SLOT_IDS[variant] ?? "";
  const useAdSense = consent?.marketing && GOOGLE_ADS_CLIENT.startsWith("ca-pub-") && slotId;

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
        {useAdSense ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block", minHeight: size.height, width: size.width }}
            data-ad-client={GOOGLE_ADS_CLIENT}
            data-ad-slot={slotId}
            data-ad-format={variant === "rectangle" ? "rectangle" : variant === "strip" ? "horizontal" : variant === "native" ? "fluid" : variant === "interstitial" ? "auto" : "auto"}
            data-full-width-responsive={variant === "strip"}
          />
        ) : directAd?.imageUrl ? (
          <a
            href={directAd.link || "#"}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block w-full h-full min-h-[50px]"
          >
            <img
              src={directAd.imageUrl}
              alt={directAd.alt || "Reclama"}
              className="w-full h-full object-contain"
            />
          </a>
        ) : isDiscrete ? (
          <span className="text-[10px] text-dark-500 opacity-70">Reclama</span>
        ) : (
          <div className="text-center p-3 text-dark-500 text-xs">
            <span className="block font-medium text-dark-400 mb-1">Spatiu publicitar</span>
            <span className="block">
              {variant === "strip"
                ? "Banner full-width – Google AdSense sau reclama directa"
                : "AdSense / reclama directa – configureaza NEXT_PUBLIC_GOOGLE_ADS_ID si slot-uri"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
