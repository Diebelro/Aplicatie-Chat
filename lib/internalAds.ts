/** Reclame interne (campanii proprii) cu opțional filtru pe țară. */

export interface InternalAd {
  id: string;
  imageUrl?: string;
  link?: string;
  html?: string;
  alt?: string;
  country?: string;
}

const INTERNAL_ADS: InternalAd[] = [
  { id: "internal-1", alt: "Ofertă", country: "RO", imageUrl: process.env.NEXT_PUBLIC_AD_INTERNAL_1_IMAGE, link: process.env.NEXT_PUBLIC_AD_INTERNAL_1_LINK },
  { id: "internal-2", alt: "Reclamă", country: "RO", imageUrl: process.env.NEXT_PUBLIC_AD_INTERNAL_2_IMAGE, link: process.env.NEXT_PUBLIC_AD_INTERNAL_2_LINK },
  { id: "internal-global", alt: "Reclamă", imageUrl: process.env.NEXT_PUBLIC_AD_INTERNAL_GLOBAL_IMAGE, link: process.env.NEXT_PUBLIC_AD_INTERNAL_GLOBAL_LINK },
];

/** Returnează reclamele interne disponibile, filtrate după țara utilizatorului. */
export function getInternalAdsForCountry(country: string | null | undefined): InternalAd[] {
  const code = country?.trim().toUpperCase() ?? "";
  return INTERNAL_ADS.filter((a) => !a.country || a.country.toUpperCase() === code).filter((a) => a.imageUrl || a.link);
}
