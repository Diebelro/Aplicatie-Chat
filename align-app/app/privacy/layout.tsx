import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Confidențialitate",
  description:
    "Cum prelucrăm datele tale în Diebel, temeiurile legale și drepturile tale conform GDPR.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
