import { canonicalCountryKey } from "@/lib/countrySoftRegion";
import { normalizeStrict } from "@/lib/discoverMatchUtils";

/** Estimare pieță după prefix IP (fără GeoIP plătit). Aprox. RO / DE / altceva. */
const DE_IP_PREFIXES = [
  "78.48.",
  "78.49.",
  "78.50.",
  "78.51.",
  "78.52.",
  "78.53.",
  "78.54.",
  "80.140.",
  "80.141.",
  "80.142.",
  "80.143.",
  "80.144.",
  "80.145.",
  "80.146.",
  "80.147.",
  "80.148.",
  "80.149.",
  "80.150.",
  "80.151.",
  "80.152.",
  "80.153.",
  "80.187.",
  "91.12.",
  "91.13.",
  "91.14.",
  "91.15.",
  "91.16.",
  "91.17.",
  "91.18.",
  "91.19.",
  "91.20.",
  "91.21.",
  "91.22.",
  "91.23.",
  "91.24.",
  "91.25.",
  "91.26.",
  "91.27.",
  "91.28.",
  "91.29.",
  "91.30.",
  "91.31.",
  "91.32.",
  "91.33.",
  "91.34.",
  "91.35.",
  "91.36.",
  "91.37.",
  "91.38.",
  "91.39.",
  "91.40.",
  "91.41.",
  "91.42.",
  "91.43.",
  "91.44.",
  "91.45.",
  "91.46.",
  "91.47.",
  "91.48.",
  "91.49.",
  "91.50.",
  "91.51.",
  "91.52.",
  "91.53.",
  "91.54.",
  "91.55.",
  "91.56.",
  "91.57.",
  "91.58.",
  "91.59.",
  "91.60.",
  "91.61.",
  "91.62.",
  "91.63.",
  "91.64.",
  "91.65.",
  "92.208.",
  "92.209.",
  "92.210.",
  "92.211.",
  "109.40.",
  "109.41.",
  "109.42.",
  "109.43.",
  "109.44.",
  "109.45.",
  "109.46.",
  "109.47.",
  "178.24.",
  "178.25.",
  "178.26.",
  "178.27.",
  "188.174.",
  "217.80.",
  "217.81.",
  "217.82.",
  "217.83.",
  "217.84.",
  "217.85.",
  "217.86.",
  "217.87.",
  "217.88.",
  "217.89.",
  "217.90.",
  "217.91.",
  "217.92.",
  "217.93.",
  "217.94.",
  "217.95.",
];

const RO_IP_PREFIXES = [
  "5.12.",
  "5.13.",
  "5.14.",
  "5.15.",
  "37.120.",
  "37.251.",
  "79.112.",
  "79.113.",
  "79.114.",
  "79.115.",
  "79.116.",
  "79.117.",
  "79.118.",
  "79.119.",
  "82.76.",
  "82.77.",
  "82.78.",
  "82.79.",
  "86.120.",
  "86.121.",
  "86.122.",
  "86.123.",
  "86.124.",
  "86.125.",
  "86.126.",
  "86.127.",
  "89.34.",
  "89.35.",
  "89.36.",
  "89.37.",
  "89.38.",
  "89.39.",
  "89.40.",
  "89.41.",
  "89.42.",
  "89.43.",
  "89.44.",
  "89.45.",
  "109.163.",
  "109.166.",
  "188.24.",
  "188.25.",
  "188.26.",
  "188.27.",
  "193.226.",
  "193.230.",
  "193.231.",
];

export type IpMarketGuess = "de" | "ro" | "other" | "unknown";

export function guessIpMarket(ip: string | null | undefined): IpMarketGuess {
  const v = (ip ?? "").trim();
  if (!v) return "unknown";
  if (DE_IP_PREFIXES.some((p) => v.startsWith(p))) return "de";
  if (RO_IP_PREFIXES.some((p) => v.startsWith(p))) return "ro";
  return "other";
}

export function profileCountryBucket(country: string | null | undefined): string {
  const raw = (country ?? "").trim();
  if (!raw) return "(fără țară)";
  const key = canonicalCountryKey(raw);
  if (!key) return "(fără țară)";
  const labels: Record<string, string> = {
    ro: "România",
    de: "Germania",
    fr: "Franța",
    it: "Italia",
    es: "Spania",
    uk: "UK",
    at: "Austria",
    hu: "Ungaria",
    bg: "Bulgaria",
    md: "Moldova",
    pl: "Polonia",
  };
  if (labels[key]) return labels[key];
  // Cheie necunoscută → afișăm textul normalizat scurt
  return normalizeStrict(raw).slice(0, 40) || "(fără țară)";
}

export function ipMarketLabel(g: IpMarketGuess): string {
  switch (g) {
    case "de":
      return "Probabil DE (IP)";
    case "ro":
      return "Probabil RO (IP)";
    case "other":
      return "Alt IP";
    default:
      return "Fără IP";
  }
}
