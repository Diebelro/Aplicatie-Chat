import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { DisableDevTools } from "@/components/DisableDevTools";
import { PwaServiceWorkerRegister } from "@/components/PwaServiceWorkerRegister";
import { getPublicAppUrl, CHAT_PRODUCTION_URL } from "@/lib/appUrl";

const siteUrlRaw = getPublicAppUrl();
let metadataBaseUrl =
  siteUrlRaw.startsWith("http://localhost") || siteUrlRaw.startsWith("http://127.0.0.1")
    ? (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
        CHAT_PRODUCTION_URL)
    : siteUrlRaw.replace(/\/$/, "");
if (!metadataBaseUrl.trim() || !/^https?:\/\//i.test(metadataBaseUrl.trim())) {
  metadataBaseUrl = CHAT_PRODUCTION_URL;
}

const defaultTitle = "Diebel — Same intent. Real connections.";
const defaultDescription =
  "Alege intenția ta. Vezi doar oameni care vor același lucru. Fără confuzie, fără timp irosit.";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  metadataBase: new URL(`${metadataBaseUrl}/`),
  icons: {
    icon: [
      { url: "/icons/icon-192-any.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512-any.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192-any.png", sizes: "192x192", type: "image/png" }],
  },
  title: {
    default: defaultTitle,
    template: "%s | Diebel",
  },
  description: defaultDescription,
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Diebel",
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: defaultDescription,
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Diebel" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0FB9B1",
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
        <PwaServiceWorkerRegister />
        <DisableDevTools />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
