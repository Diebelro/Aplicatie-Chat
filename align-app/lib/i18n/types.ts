export type Locale = "ro" | "en" | "de";

export const LOCALES: Locale[] = ["ro", "en", "de"];
export const DEFAULT_LOCALE: Locale = "ro";

export interface CookieConsentTranslations {
  bannerText: string;
  accept: string;
  refuse: string;
  preferences: string;
  settingsButton: string;
  necessary: string;
  functional: string;
  statistics: string;
  marketing: string;
  necessaryDesc: string;
  functionalDesc: string;
  statisticsDesc: string;
  marketingDesc: string;
}

export interface CommonTranslations {
  buttons: Record<string, string>;
  labels: Record<string, string>;
}

export interface LegalLinkTranslations {
  terms: string;
  privacy: string;
  cookies: string;
}

export interface LegalSection {
  title: string;
  content: string[];
}

/** UI-only legal strings (titles + link labels). Full legal text lives in legalContent.ts. */
export interface LegalTranslations {
  links: LegalLinkTranslations;
  /** Intro line above cross-links on /terms, /privacy, /cookies */
  relatedDocs: string;
  termsTitle: string;
  privacyTitle: string;
  cookiesTitle: string;
}

export interface Translations {
  cookieConsent: CookieConsentTranslations;
  common: CommonTranslations;
  legal: LegalTranslations;
}
