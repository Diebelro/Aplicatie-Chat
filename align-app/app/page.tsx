import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Landing — structură neschimbată (header, hero, CTA); texte ro/en/de din mesaje + LanguageSwitcher în footer. */
export default function HomePage() {
  return <HomePageContent />;
}
