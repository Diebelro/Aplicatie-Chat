export const BAN_REASON_CODES = [
  "nsfw",
  "photo",
  "fake",
  "harassment",
  "spam",
  "underage",
  "username",
  "other",
] as const;

export type BanReasonCode = (typeof BAN_REASON_CODES)[number];

export const BAN_REASON_ADMIN_LABELS: Record<BanReasonCode, string> = {
  nsfw: "Poze indecente / nuditate",
  photo: "Poză ștearsă / conținut foto interzis",
  fake: "Profil fals / catfish",
  harassment: "Hărțuire / mesaje agresive",
  spam: "Spam / înșelătorie",
  underage: "Minor / vârstă sub 18",
  username: "Username sau bio inadecvat",
  other: "Alt motiv (scrie tu)",
};

const BAN_REASON_NOTICE_RO: Record<BanReasonCode, string> = {
  nsfw: "poze sau conținut sexual / nuditate, interzise în aplicație",
  photo: "poză care nu respectă regulile comunității",
  fake: "profil fals sau identitate înșelătoare",
  harassment: "hărțuire, insulte sau comportament agresiv",
  spam: "spam, publicitate sau încercare de înșelătorie",
  underage: "contul nu respectă limita de vârstă (18+)",
  username: "nume sau descriere care încalcă regulile",
  other: "încălcare a regulilor comunității",
};

export function userFacingReasonRo(stored: string): string {
  const parsed = parseStoredBanReason(stored);
  if (!parsed) return BAN_REASON_NOTICE_RO.other;
  if (parsed.code === "other" && parsed.note) return parsed.note;
  return BAN_REASON_NOTICE_RO[parsed.code];
}

export function photoRemovedNoticeRo(stored: string, all: boolean): string {
  const why = userFacingReasonRo(stored);
  if (all) {
    return `Ți-am șters pozele de pe profil. Motiv: ${why}. Încarcă doar poze care respectă regulile comunității.`;
  }
  return `Ți-am șters o poză de pe profil. Motiv: ${why}. Încarcă doar poze care respectă regulile comunității.`;
}

export function isBanReasonCode(v: string): v is BanReasonCode {
  return (BAN_REASON_CODES as readonly string[]).includes(v);
}

export function encodeStoredBanReason(code: BanReasonCode, note: string): string {
  const n = note.trim().slice(0, 400);
  if (code === "other") return n ? `other:${n}` : "other";
  return code;
}

export function parseStoredBanReason(raw: string | null | undefined): {
  code: BanReasonCode;
  note: string;
} | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  if (s.startsWith("other:")) {
    return { code: "other", note: s.slice(6).trim().slice(0, 400) };
  }
  if (isBanReasonCode(s)) return { code: s, note: "" };
  return { code: "other", note: s.slice(0, 400) };
}

export function parseBanReasonFromBody(body: unknown): { stored: string } | { error: string } {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const codeRaw = typeof rec.reasonCode === "string" ? rec.reasonCode.trim() : "";
  const note = typeof rec.reasonNote === "string" ? rec.reasonNote.trim() : "";
  if (!isBanReasonCode(codeRaw)) {
    return { error: "Alege un motiv." };
  }
  if (codeRaw === "other" && note.length < 3) {
    return { error: "Pentru „Alt motiv” scrie cel puțin 3 caractere." };
  }
  return { stored: encodeStoredBanReason(codeRaw, note) };
}
