import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Cookie-uri",
  description:
    "Cookie-urile folosite în Diebel, scopurile lor și cum îți poți gestiona preferințele.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
