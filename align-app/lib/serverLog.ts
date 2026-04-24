/**
 * Logare server-side pentru incidente: o linie, fără body-uri sau token-uri.
 * Dezactivează cu DISABLE_SERVER_ERROR_LOG=1. Stack complet doar cu LOG_ERROR_STACK=1.
 */

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function logServerError(
  scope: string,
  err: unknown,
  meta?: Record<string, string | number | boolean | null | undefined>
): void {
  if (process.env.DISABLE_SERVER_ERROR_LOG === "1") return;
  const msg = safeMessage(err);
  const metaStr =
    meta && Object.keys(meta).length > 0
      ? ` ${JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([, v]) => v != null)))}`
      : "";
  const line = `[${scope}]${metaStr} ${msg}`;
  if (process.env.LOG_ERROR_STACK === "1" && err instanceof Error && err.stack) {
    console.error(line, "\n", err.stack);
  } else {
    console.error(line);
  }
}
