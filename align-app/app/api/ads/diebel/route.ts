import { NextRequest, NextResponse } from "next/server";

function adsOrigin() {
  return (
    process.env.DIEBEL_ADS_URL ||
    process.env.NEXT_PUBLIC_DIEBEL_ADS_URL ||
    (process.env.NODE_ENV === "production" ? "https://ads.diebel.ro" : "http://127.0.0.1:3040")
  ).replace(/\/$/, "");
}

/** Textele house (fallback) urmează limba cerută de client; Diebel Ads răspunde și el după Accept-Language. */
type HouseAd = { title: string; body: string; cta: string; click: string; city: string; house?: boolean; product?: string };

const BOOST_BY_LANG: Record<string, HouseAd> = {
  ro: {
    title: "Diebel Ads",
    body: "Ai o firmă? Pornește un Boost de la 10 €. Se vede pe rețea. Banii se văd live.",
    cta: "Pornește un Boost",
    click: "https://ads.diebel.ro/campanie/nou",
    city: "Diebel",
    house: true,
    product: "house_ads",
  },
  en: {
    title: "Diebel Ads",
    body: "Have a business? Start a Boost from 10 €. It runs on the network. The money stays visible.",
    cta: "Start a Boost",
    click: "https://ads.diebel.ro/campanie/nou",
    city: "Diebel",
    house: true,
    product: "house_ads",
  },
  de: {
    title: "Diebel Ads",
    body: "Hast du ein Unternehmen? Starte einen Boost ab 10 €. Läuft im Netzwerk. Das Geld bleibt sichtbar.",
    cta: "Boost starten",
    click: "https://ads.diebel.ro/campanie/nou",
    city: "Diebel",
    house: true,
    product: "house_ads",
  },
};

const HOUSE_BY_LANG: Record<string, HouseAd[]> = {
  ro: [
    BOOST_BY_LANG.ro,
    { title: "AnunțAI", body: "Pune un anunț. Găsește cumpărători locali.", cta: "Deschide AnunțAI", click: "https://anunturi.diebel.ro", city: "Diebel" },
    { title: "Diebel Transfer", body: "Trimite fișiere mari, simplu.", cta: "Trimite un fișier", click: "https://transfer.diebel.ro", city: "Diebel" },
    { title: "Ai un site?", body: "Lasă domeniul. Punem reclama. Din 10 €, 6,20 € sunt ai tăi.", cta: "Am acest site", click: "https://ads.diebel.ro/publishers#ofer", city: "Diebel" },
  ],
  en: [
    BOOST_BY_LANG.en,
    { title: "AnunțAI", body: "Post a listing. Find local buyers.", cta: "Open AnunțAI", click: "https://anunturi.diebel.ro", city: "Diebel" },
    { title: "Diebel Transfer", body: "Send large files, simply.", cta: "Send a file", click: "https://transfer.diebel.ro", city: "Diebel" },
    { title: "Have a site?", body: "Leave the domain. We place the ad. Of 10 €, 6.20 € is yours.", cta: "This is my site", click: "https://ads.diebel.ro/publishers#ofer", city: "Diebel" },
  ],
  de: [
    BOOST_BY_LANG.de,
    { title: "AnunțAI", body: "Anzeige aufgeben. Lokale Käufer finden.", cta: "AnunțAI öffnen", click: "https://anunturi.diebel.ro", city: "Diebel" },
    { title: "Diebel Transfer", body: "Große Dateien einfach senden.", cta: "Datei senden", click: "https://transfer.diebel.ro", city: "Diebel" },
    { title: "Hast du eine Website?", body: "Domain angeben. Wir platzieren die Anzeige. Von 10 € sind 6,20 € für dich.", cta: "Das ist meine Website", click: "https://ads.diebel.ro/publishers#ofer", city: "Diebel" },
  ],
};

function pickLang(request: NextRequest): "ro" | "en" | "de" {
  const explicit = (request.nextUrl.searchParams.get("lang") || "").toLowerCase();
  if (explicit === "ro" || explicit === "en" || explicit === "de") return explicit;
  const header = (request.headers.get("accept-language") || "").toLowerCase();
  if (header.startsWith("ro")) return "ro";
  if (header.startsWith("de")) return "de";
  return "en";
}

/** Doar https pe diebel.ro / *.diebel.ro — altfel fallback. */
function safeDiebelHttpsUrl(raw: unknown, fallback: string | null): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return fallback;
  try {
    const url = new URL(value, "https://ads.diebel.ro");
    if (url.protocol !== "https:") return fallback;
    const host = url.hostname.toLowerCase();
    if (host !== "diebel.ro" && !host.endsWith(".diebel.ro")) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function absoluteClick(click: string, origin: string) {
  if (!click) return BOOST_BY_LANG.en.click;
  if (click.startsWith("http://") || click.startsWith("https://")) return click;
  return `${origin}${click.startsWith("/") ? click : `/${click}`}`;
}

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(request: NextRequest) {
  const slot = request.nextUrl.searchParams.get("slot") ?? "strip";
  const origin = adsOrigin();
  const lang = pickLang(request);
  const boost = BOOST_BY_LANG[lang];

  // Banda de sus din Chat: mereu Boost cu link real.
  if (slot === "strip") {
    return NextResponse.json({ ad: boost, source: "boost_strip" });
  }

  if (origin) {
    try {
      const placement = slot === "native" ? "pl_prop_chat_strip" : "pl_prop_chat_banner";
      const res = await fetch(`${origin}/api/ads/decide?placement=${placement}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
        headers: { "accept-language": lang },
      });
      const json = await res.json();
      const title = text(json?.ad?.title, 120);
      const click = safeDiebelHttpsUrl(absoluteClick(text(json?.ad?.click, 500), origin), null);
      if (title && click) {
        // Doar câmpuri cunoscute; imaginea doar de pe diebel.ro (fără tracking terț / mixed content).
        return NextResponse.json({
          ad: {
            title,
            body: text(json.ad.body, 300),
            cta: text(json.ad.cta, 80) || boost.cta,
            click,
            city: text(json.ad.city, 60) || "Diebel",
            image: safeDiebelHttpsUrl(json.ad.image, null),
            house: json.ad.house === true,
            product: text(json.ad.product, 60) || undefined,
          },
          source: "diebel_ads",
        });
      }
    } catch {
      /* Ads offline */
    }
  }

  const list = HOUSE_BY_LANG[lang];
  const fallback = list[Math.floor(Math.random() * list.length)];
  return NextResponse.json({
    ad: { ...fallback, click: absoluteClick(fallback.click, "https://ads.diebel.ro") },
    source: "fallback",
  });
}
