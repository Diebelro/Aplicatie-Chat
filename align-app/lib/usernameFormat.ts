export const USERNAME_HELP_TEXT = "2–30 caractere, doar litere, cifre, punct și liniuță jos.";

export function validateUsername(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const raw = String(input ?? "").trim();
  const value = raw.toLowerCase();
  if (value.length < 2) return { ok: false, error: "Username-ul trebuie să aibă cel puțin 2 caractere." };
  if (value.length > 30) return { ok: false, error: "Username-ul poate avea maximum 30 de caractere." };
  if (!/^[a-zA-Z0-9_.]+$/.test(value)) return { ok: false, error: USERNAME_HELP_TEXT };
  return { ok: true, value };
}
