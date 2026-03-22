import type { MetadataRoute } from "next";

/**
 * Web App Manifest — necesar pentru „Adaugă pe ecranul principal” și pentru pachete Play (TWA/PWABuilder).
 * Adaugă PNG-uri reale în public/icons/ (vezi docs/lansare-google-play.md).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Align",
    short_name: "Align",
    description:
      "Alege intenția ta. Vezi doar oameni care vor același lucru. Fără confuzie, fără timp irosit.",
    start_url: "/",
    scope: "/",
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
