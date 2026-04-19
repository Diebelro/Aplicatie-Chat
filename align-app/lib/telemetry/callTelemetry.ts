/**
 * Telemetrie apel — fără PII; activă doar când NEXT_PUBLIC_CALL_TELEMETRY=1.
 * Implicit: no-op (zero cost în producție fără flag).
 */
export function emit(eventName: string, meta?: Record<string, string | number | boolean>): void {
  if (process.env.NEXT_PUBLIC_CALL_TELEMETRY !== "1") return;
  try {
    const payload = { event: eventName, t: Date.now(), ...meta };
    console.info("[CALL_TELEMETRY]", payload);
  } catch {
    /* ignore */
  }
}
