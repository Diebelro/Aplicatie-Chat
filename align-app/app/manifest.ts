import type { MetadataRoute } from "next";

/**
 * Web App Manifest – pentru „Adaugă pe ecranul principal” pe telefon
 * și afișare corectă pe mobile (fullscreen, tema, icon).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Align — Same intent. Real connections.",
    short_name: "Align",
    description: "Alege intenția ta. Vezi doar oameni care vor același lucru.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f12",
    theme_color: "#0f0f12",
    orientation: "portrait-primary",
    scope: "/",
    // Adaugă în public/ icon-192.png și icon-512.png pentru „Adaugă pe ecranul principal”
    icons: [],
    categories: ["social", "dating"],
  };
}
