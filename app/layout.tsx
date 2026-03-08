import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { DisableDevTools } from "@/components/DisableDevTools";

export const metadata: Metadata = {
  title: "Align — Same intent. Real connections.",
  description:
    "Alege intentia ta. Vezi doar oameni care vor acelasi lucru. Fara confuzie, fara timp irosit.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body className="antialiased min-h-screen font-sans bg-dark-900 text-gray-100">
        <DisableDevTools />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
