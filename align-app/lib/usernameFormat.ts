export type UsernameFailReason = "too_short" | "too_long" | "invalid_chars";

export function validateUsername(
  input: string
): { ok: true; value: string } | { ok: false; reason: UsernameFailReason } {
  const raw = String(input ?? "").trim();
  const value = raw.toLowerCase();
  if (value.length < 2) return { ok: false, reason: "too_short" };
  if (value.length > 30) return { ok: false, reason: "too_long" };
  if (!/^[a-zA-Z0-9_.]+$/.test(value)) return { ok: false, reason: "invalid_chars" };
  return { ok: true, value };
}
