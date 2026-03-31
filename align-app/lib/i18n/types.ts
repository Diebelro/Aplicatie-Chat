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
  /** Mesaj bandă „site în lucru” (NEXT_PUBLIC_SHOW_WIP_BANNER) */
  wipBanner: string;
}

export interface HomeTranslations {
  login: string;
  signup: string;
  headlineBefore: string;
  headlineAccent: string;
  subhead: string;
  cta: string;
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

/** Meniu principal aplicație autentificată (/app). */
export interface AppNavTranslations {
  loading: string;
  completeProfile: string;
  discover: string;
  allProfiles: string;
  messages: string;
  missedCalls: string;
  conference: string;
  matches: string;
  reviewSwipes: string;
  reviewSwipesTitle: string;
  map: string;
  premium: string;
  admin: string;
  adminPanelTitle: string;
  suggestions: string;
  accountSettings: string;
  logout: string;
  menuOpen: string;
  menuClose: string;
  suggestionsFeedback: string;
  legalFooterIntro: string;
  matchWithBefore: string;
  matchWithAfter: string;
  openChat: string;
  legalNavAria: string;
  /** Nume generic când lipsește (ex. notificare match). */
  anonymousUser: string;
}

/** Pagini aplicație — structură în `messages/*.json` sub cheia `pages` (ex. pages.matches.title). */
export type PagesTranslations = Record<string, unknown>;

export interface Translations {
  cookieConsent: CookieConsentTranslations;
  common: CommonTranslations;
  legal: LegalTranslations;
  home: HomeTranslations;
  appNav: AppNavTranslations;
  pages: PagesTranslations;
}
