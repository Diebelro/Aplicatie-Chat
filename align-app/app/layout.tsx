import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { DisableDevTools } from "@/components/DisableDevTools";
import { InLucruBanner } from "@/components/InLucruBanner";

export const metadata: Metadata = {
  title: "Align — Same intent. Real connections.",
  description:
    "Alege intentia ta. Vezi doar oameni care vor acelasi lucru. Fara confuzie, fara timp irosit.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Align" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0f0f12" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen font-sans bg-dark-900 text-gray-100"
        style={{
          // Fallback când CSS-ul Tailwind nu se încarcă (preview iframe, CDN blocat, etc.)
          backgroundColor: "var(--bg, #0f1419)",
          color: "var(--text, #e7e9ea)",
        }}
      >
        <DisableDevTools />
        {process.env.NEXT_PUBLIC_SHOW_WIP_BANNER === "true" ? <InLucruBanner /> : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
