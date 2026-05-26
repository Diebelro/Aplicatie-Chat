import type { Metadata } from "next";

/** SEO / share cards; conținutul paginii rămâne tradus din clientside. */
export const metadata: Metadata = {
  title: "Regulile comunității",
  description:
    "Diebel: aplicație 18+. Regulile comunității — conținut permis și interdicții. Community rules for the Diebel app.",
  robots: { index: true, follow: true },
};

export default function CommunityRulesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
