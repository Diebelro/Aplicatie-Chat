import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/appUrl";

/**
 * Web App Manifest — necesar pentru „Adaugă pe ecranul principal” și pentru pachete Play (TWA/PWABuilder).
 * Adaugă PNG-uri reale în public/icons/ (vezi docs/lansare-google-play.md).
 * `start_url` / `scope` pe hostul public (ex. chat.diebel.ro) — altfel PWA deschis de pe chat te poate încurca cu apex.
 */
export default function manifest(): MetadataRoute.Manifest {
  const origin = getPublicAppUrl().replace(/\/$/, "");
  const prefix = origin.startsWith("http") ? origin : "";
  return {
    name: "Align",
    short_name: "Align",
    description:
      "Alege intenția ta. Vezi doar oameni care vor același lucru. Fără confuzie, fără timp irosit.",
    start_url: prefix ? `${prefix}/` : "/",
    scope: prefix ? `${prefix}/` : "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0f1419",
    theme_color: "#0f1419",
    lang: "ro",
    categories: ["social", "lifestyle"],
    // Adaugă fișierele în public/icons/ (vezi public/icons/README.md)
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
