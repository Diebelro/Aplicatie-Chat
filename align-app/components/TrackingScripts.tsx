"use client";

import Script from "next/script";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

function isValidGa4Id(id: string | undefined): id is string {
  if (!id?.trim()) return false;
  const v = id.trim();
  if (v === "G-XXXXXXXXXX" || /X{5,}/i.test(v)) return false;
  return /^G-[A-Z0-9]+$/i.test(v);
}

function isValidMetaPixelId(id: string | undefined): id is string {
  if (!id?.trim()) return false;
  const v = id.trim();
  if (v === "XXXXXXXXXX" || /^X+$/i.test(v)) return false;
  return /^\d{10,20}$/.test(v);
}

function isValidGoogleAdsClientId(id: string | undefined): id is string {
  if (!id?.trim()) return false;
  const v = id.trim();
  if (v.includes("XXXXXXXX") || v === "ca-pub-XXXXXXXXXX") return false;
  return /^ca-pub-\d+$/i.test(v);
}

export function TrackingScripts() {
  const { consent } = useCookieConsent();

  const gaId = process.env.NEXT_PUBLIC_GA4_ID;
  const metaId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

  const gaOk = isValidGa4Id(gaId);
  const metaOk = isValidMetaPixelId(metaId);
  const adsOk = isValidGoogleAdsClientId(adsId);

  if (!consent) return null;

  return (
    <>
      {consent.statistics && gaOk && (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
      )}
      {consent.statistics && gaOk && (
        <Script id="ga4-config" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `}
        </Script>
      )}
      {consent.marketing && metaOk && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
      {consent.marketing && adsOk && (
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsId}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
