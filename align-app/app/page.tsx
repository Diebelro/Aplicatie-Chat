import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";

export const metadata: Metadata = {
  title: "Diebel — Free Chat, Video Calls & Dating App for Adults",
  description:
    "Meet people nearby, send messages and make free video or audio calls on Diebel. Dating and chat app for adults 18+. No ads. Available on Android and web.",
  alternates: {
    canonical: "/",
    languages: {
      "en": "/",
      "ro": "/",
      "de": "/",
      "fr": "/",
      "it": "/",
      "es": "/",
      "x-default": "/",
    },
  },
};

/** Landing — structură neschimbată (header, hero, CTA); texte ro/en/de din mesaje + LanguageSwitcher în footer. */
export default function HomePage() {
  return <HomePageContent />;
}
