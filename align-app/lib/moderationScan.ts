/**
 * Heuristică pentru moderatori (admin). Nu e „AI”: sunt potriviri simple pe text.
 * Listele pot fi extinse; rezultatele trebuie verify manual înainte de sancțiuni.
 */

export type ModerationCategoryId =
  | "threats"
  | "sexual"
  | "insults"
  | "minors"
  | "scams"
  | "illegal_trade"
  | "bot_automation";

export const MODERATION_CATEGORY_LABELS: Record<ModerationCategoryId, string> = {
  threats: "Amenințări",
  sexual: "Limbaj sexual explicit",
  insults: "Injurii / jigniri grave",
  minors: "Indicatori minori / grooming",
  scams: "Țeapă / înșelăciune / phishing",
  illegal_trade: "Droguri / furt / comerț ilegal",
  bot_automation: "Bot / automat / cont neuman",
};

/** Cuvinte / fragmente normalizate fără diacritice, lowercase. */
const KEYWORDS: Record<ModerationCategoryId, string[]> = {
  threats: [
    "te omor",
    "te bat",
    "te bate",
    "o sa te omor",
    "o să te omor",
    "te distrug",
    "iti distrug",
    "îți distrug",
    "fac scandal",
    "afla unde stai",
    "stiu unde locui",
    "ti-o trag",
    "rupem capul",
    "te rupe",
    "kill you",
    "i will kill",
    "beat you up",
    "hurt you",
    "find your address",
  ],
  sexual: [
    "pula",
    "pizd",
    "muie",
    "suge",
    "fac sex",
    "sex acum",
    "poză goală",
    "poza goala",
    "poze nud",
    "video xxx",
    "call sex",
    "sex chat",
    "masturb",
    "ejacul",
    "penetr",
    "fuck you",
    "nudes",
    "suck my",
    "sex anal",
    "oral sex",
  ],
  insults: [
    "muie",
    "fraier",
    "proasta",
    "prostule",
    "cretin",
    "cretină",
    "idiot",
    "idioata",
    "tampit",
    "țărână",
    "tarane",
    "curvă",
    "curva",
    "zdreanță",
    "zdrenta",
    "animalule",
    "să mori",
    "căcatule",
    "ratatule",
    "handicap",
    "retard",
    "bulangi",
    "spoitor",
  ],
  /** Comportament care sugerează interes față de minori — verificare umană obligatorie. */
  minors: [
    "minor",
    "minora",
    "minore",
    "minoren",
    "sunt minora",
    "sunt minor",
    "sub 18",
    "sub18",
    "14 ani",
    "15 ani",
    "16 ani",
    "17 ani",
    "clasa a ",
    "liceu ",
    "generală",
    "generala",
    "elevă",
    "eleva",
    "elev ",
    "copil",
    "adolescent",
    "fetita",
    "fetiță",
    "baietas",
    "băiețel",
    "pedo",
    "loli",
    "shota",
    "cp ",
    "young teen",
    "underage",
    "how old are you",
    "cati ani ai",
    "câți ani ai",
    "esti minora",
    "ești minoră",
    "meet minor",
    "sex cu minora",
  ],
  /** Înșelăciune financiară, „investiții”, phishing — verificare manuală. */
  scams: [
    "teapa",
    "tapa",
    "pacaleala",
    "pacalit",
    "pacaleste",
    "inselaciune",
    "inselatorie",
    "escroc",
    "escrocherie",
    "phishing",
    "scam",
    "schema ponzi",
    "piramidala",
    "piramidal",
    "dublare bani",
    "dubleaza banii",
    "investitie garantata",
    "castig garantat",
    "profit garantat",
    "trimite avans",
    "plateste avans",
    "taxa in avans",
    "cod otp",
    "de pe card",
    "datele cardului",
    "pin-ul card",
    "mostenire de la",
    "mostenitor nigerian",
    "western union",
    "moneygram",
    "trimite bani urgent",
    "recovery wallet",
    "seed phrase",
    "fraza secreta",
    "cheie privata wallet",
    "crypto recovery",
    "recuperare cont paypal",
    "verifica link-ul",
    "completeaza formularul banca",
  ],
  /** Droguri, trafic, obiecte furate, arme — verificare manuală și, dacă e cazul, autorități. */
  illegal_trade: [
    "droguri",
    "vinzi drog",
    "cumpar drog",
    "cumpar iarba",
    "cocaina",
    "heroina",
    "metamfetamina",
    "ecstasy",
    "ketamina",
    "xanax de vanzare",
    "dealer ",
    "livrare drog",
    "gram de iarba",
    "hasis",
    "canabis de vanzare",
    "marijuana",
    "lsd",
    "cnp de vanzare",
    "act identitate fals",
    "buletine false",
    "telefon furat",
    "iphone furat",
    "obiecte furate",
    "am furat",
    "arma de foc",
    "pistol de vanzare",
    "gloante",
    "silencer",
    "traversa frontiera cu",
    "trafic de droguri",
    "plantatie cannabis",
  ],
  /** Mesaje care sugerează cont scriptat, AI sau „nu sunt om” — verificare manuală. */
  bot_automation: [
    "sunt bot",
    "sunt un bot",
    "sunt chatbot",
    "cont bot",
    "nu sunt om",
    "nu sunt persoana reala",
    "nu sunt o persoana",
    "nu sunt persoana adevarata",
    "sunt program",
    "sunt un program",
    "generat de chatgpt",
    "chatgpt mi-a",
    "chatgpt a scris",
    "scrie chatgpt",
    "openai a generat",
    "mesaj generat de ai",
    "raspuns automat de la script",
    "scriptul trimite",
    "rulez pe server",
    "telegram bot",
    "discord bot",
    "api bot",
    "selenium ",
    "puppeteer",
    "webdriver",
    "headless browser",
    "headless chrome",
    "auto reply bot",
    "mass messaging tool",
    "trimite in masa",
    "farm de conturi",
    "fake profile automation",
    "nu sunt uman",
    "sunt artificiala",
    "sunt artificial",
  ],
};

export function normalizeModerationText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returnează id-urile categoriilor care se potrivesc pe text.
 * `onlyCategories` — dacă setat, evaluează doar acele categorii.
 */
export function scanMessageForCategories(
  text: string,
  onlyCategories?: ModerationCategoryId[] | null
): ModerationCategoryId[] {
  const t = normalizeModerationText(text);
  if (!t) return [];
  const want: ModerationCategoryId[] = onlyCategories?.length
    ? onlyCategories
    : (Object.keys(KEYWORDS) as ModerationCategoryId[]);
  const hit: ModerationCategoryId[] = [];
  for (const cat of want) {
    const words = KEYWORDS[cat];
    if (words?.some((w) => t.includes(normalizeModerationText(w)))) {
      hit.push(cat);
    }
  }
  return hit;
}
