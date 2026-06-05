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

const defaultTitle = "Diebel — Chat și apeluri pentru adulți (18+)";
const defaultDescription =
  "Conexiuni cu intenție clară: mesaje, apeluri audio și video. Pentru adulți. Comunicarea cu serverele folosește criptare în tranzit (HTTPS/TLS); mesajele nu sunt criptate end-to-end între dispozitive.";

export const metadata: Metadata = {
  manifest: "/manifest.json?v=11",
  metadataBase: new URL(`${metadataBaseUrl}/`),
  icons: {
    icon: [
      { url: "/favicon.ico?v=11", type: "image/x-icon" },
      { url: "/favicon-16.png?v=11", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png?v=11", sizes: "32x32", type: "image/png" },
      { url: "/brand/app-icon-v7-192.png?v=11", sizes: "192x192", type: "image/png" },
      { url: "/brand/app-icon-v7-512.png?v=11", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/brand/app-icon-v7-192.png?v=11", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png?v=11", sizes: "180x180", type: "image/png" }],
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
  appleWebApp: { capable: true, statusBarStyle: "black", title: "Diebel" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0f1419",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen font-sans bg-dark-900 text-zinc-900 safe-area-x"
        style={{
          backgroundColor: "#0f1419",
          color: "#f4f4f5",
        }}
      >
        <PwaServiceWorkerRegister />
        <DisableDevTools />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
