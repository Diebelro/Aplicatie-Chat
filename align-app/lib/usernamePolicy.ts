/**
 * Reguli username Diebel: doar litere (fără cifre), fără obscenități (multi-limbă + leetspeak).
 */

export type UsernameFailReason =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "obscene";

/** Fragmente interzise (după normalizare: lowercase, fără diacritice/separatoare, leetspeak). */
const OBSCENE_FRAGMENTS = [
  // EN
  "bigdick",
  "bigcock",
  "hugecock",
  "fatcock",
  "dick",
  "cock",
  "penis",
  "pussy",
  "vagina",
  "nude",
  "nudes",
  "naked",
  "xxx",
  "porn",
  "porno",
  "sex",
  "sexy",
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "asshole",
  "bastard",
  "bitch",
  "whore",
  "slut",
  "cumshot",
  "onlyfans",
  "blowjob",
  "handjob",
  "deepthroat",
  "boobs",
  "tits",
  "titty",
  "horny",
  "orgasm",
  "masturb",
  "suckme",
  "suckmy",
  "cooch",
  "coochie",
  "clit",
  "cunt",
  "jizz",
  "fuckbuddy",
  // RO
  "pula",
  "pulă",
  "pizda",
  "pizd",
  "muie",
  "coaie",
  "curva",
  "curvă",
  "futut",
  "fututi",
  "futu",
  "sugipula",
  "sugin",
  "golanu",
  "goala",
  "goală",
  "sexoral",
  // DE
  "schwanz",
  "penis",
  "fotze",
  "ficken",
  "arschloch",
  "hure",
  "nutte",
  "nackt",
  "porno",
  // FR
  "bite",
  "chienne",
  "pute",
  "encule",
  "enculé",
  "nique",
  "salope",
  "couille",
  // IT
  "cazzo",
  "figa",
  "puttana",
  "troia",
  "minchia",
  "stronzo",
  // ES
  "polla",
  "verga",
  "coño",
  "cono",
  "puto",
  "puta",
  "cabron",
  "cabrón",
  "mierda",
  "pendejo",
];

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Normalizare pentru detectarea obscenităților (permite leetspeak). */
export function normalizeForObscenity(raw: string): string {
  let s = stripDiacritics(String(raw ?? "").toLowerCase());
  s = s.replace(/[^a-z0-9]/g, "");
  s = s
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
  return s;
}

/** Bio / text liber: aceleași obscenități + spam WhatsApp / Telegram / OnlyFans. */
export function bioLooksObscene(raw: string): boolean {
  if (usernameLooksObscene(raw)) return true;
  const n = normalizeForObscenity(raw);
  if (!n) return false;
  const extra = ["whatsapp", "telegram", "onlyfans", "fuckbuddy", "escort", "cashapp"];
  return extra.some((frag) => n.includes(frag));
}

export function usernameLooksObscene(raw: string): boolean {
  const n = normalizeForObscenity(raw);
  if (!n) return false;
  return OBSCENE_FRAGMENTS.some((frag) => {
    const f = normalizeForObscenity(frag);
    if (f.length < 3) return false;
    // Cuvinte foarte scurte: doar match exact (evită false positive tip „canal”/„sex”).
    if (f.length <= 3) return n === f;
    return n.includes(f);
  });
}

/**
 * Username public: 2–30 caractere, doar litere a–z (fără cifre, punct, underscore).
 */
export function validateUsername(
  input: string
): { ok: true; value: string } | { ok: false; reason: UsernameFailReason } {
  const raw = String(input ?? "").trim();
  const value = raw.toLowerCase();
  if (value.length < 2) return { ok: false, reason: "too_short" };
  if (value.length > 30) return { ok: false, reason: "too_long" };
  if (!/^[a-zA-Z]+$/.test(value)) return { ok: false, reason: "invalid_chars" };
  if (usernameLooksObscene(value)) return { ok: false, reason: "obscene" };
  return { ok: true, value };
}

export function usernameErrorMessage(
  reason: UsernameFailReason,
  t?: (key: string) => string
): string {
  const map: Record<UsernameFailReason, string> = {
    too_short: "Username-ul trebuie să aibă cel puțin 2 litere.",
    too_long: "Username-ul poate avea maximum 30 de litere.",
    invalid_chars: "Doar litere (a–z), fără cifre, spații sau simboluri.",
    obscene: "Username-ul nu este permis (limbaj indecent).",
  };
  if (t) {
    const key = `auth.usernameErrors.${reason}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return map[reason];
}
