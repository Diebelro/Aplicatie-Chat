import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { DisableDevTools } from "@/components/DisableDevTools";
import { getPublicAppUrl } from "@/lib/appUrl";

const siteUrlRaw = getPublicAppUrl();
const metadataBaseUrl =
  siteUrlRaw.startsWith("http://localhost") || siteUrlRaw.startsWith("http://127.0.0.1")
    ? (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
        "https://align-app-delta.vercel.app")
    : siteUrlRaw.replace(/\/$/, "");

const defaultTitle = "Align — Same intent. Real connections.";
const defaultDescription =
  "Alege intenția ta. Vezi doar oameni care vor același lucru. Fără confuzie, fără timp irosit.";

export const metadata: Metadata = {
  metadataBase: new URL(`${metadataBaseUrl}/`),
  title: {
    default: defaultTitle,
    template: "%s | Align",
  },
  description: defaultDescription,
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Align",
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: defaultDescription,
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Align" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f6f7" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen font-sans bg-dark-900 text-zinc-900"
        style={{
          // Fallback când CSS-ul Tailwind nu se încarcă (preview iframe, CDN blocat, etc.)
          backgroundColor: "var(--bg, #f6f6f7)",
          color: "var(--text, #18181b)",
        }}
      >
        <DisableDevTools />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
