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

const defaultTitle = "Diebel — Free Chat, Video Calls & Dating App for Adults";
const defaultDescription =
  "Meet people, chat and make free video or audio calls on Diebel. Dating and messaging app for adults 18+. Available on Android and web. Secure connections, no ads.";

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
  keywords: [
    "dating app", "video chat", "free chat app", "meet people online",
    "audio video calls", "messaging app", "adults dating", "chat app android",
    "dating app Romania", "dating Germany", "dating Switzerland",
    "Diebel", "chat gratuit", "aplicatie dating", "intalniri online",
    "kostenlose Chat App", "Dating App Deutschland", "Video Anrufe App",
    "application de rencontre", "chat vidéo gratuit", "app di incontri",
    "chat video gratis", "aplicación de citas", "videollamadas gratis",
  ],
  alternates: {
    canonical: `${metadataBaseUrl}/`,
    languages: {
      "en": `${metadataBaseUrl}/`,
      "ro": `${metadataBaseUrl}/`,
      "de": `${metadataBaseUrl}/`,
      "fr": `${metadataBaseUrl}/`,
      "it": `${metadataBaseUrl}/`,
      "es": `${metadataBaseUrl}/`,
      "x-default": `${metadataBaseUrl}/`,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ro_RO", "de_DE", "de_CH", "de_AT", "fr_FR", "fr_CH", "it_IT", "it_CH", "es_ES"],
    siteName: "Diebel",
    title: defaultTitle,
    description: defaultDescription,
    url: `${metadataBaseUrl}/`,
    images: [
      {
        url: "/brand/app-icon-v7-512.png?v=11",
        width: 512,
        height: 512,
        alt: "Diebel Chat App",
      },
    ],
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
  viewportFit: "cover",
  themeColor: "#f6f6f7",
  interactiveWidget: "resizes-content",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Diebel Chat",
  operatingSystem: "Android, Web",
  applicationCategory: "CommunicationApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description: defaultDescription,
  url: `${metadataBaseUrl}/`,
  downloadUrl: "https://play.google.com/store/apps/details?id=ro.diebel.chatapp",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.5",
    ratingCount: "10",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="antialiased min-h-screen font-sans bg-dark-900 text-zinc-900 safe-area-x"
        style={{
          backgroundColor: "#f6f6f7",
          color: "#18181b",
        }}
      >
        <PwaServiceWorkerRegister />
        <DisableDevTools />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
