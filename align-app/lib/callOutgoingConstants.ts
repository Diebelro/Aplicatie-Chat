/**
 * Constante pentru poll-ul apelantului către `GET /api/call/outgoing-status`.
 * Păstrate aici ca să nu fie „numere magice” împrăștiate în UI — un singur loc la schimbări.
 */
/** Interval între poll-uri (ms). Prea mic = mai multe curse cu DB; prea mare = UI mai lent la respingere. */
export const OUTGOING_CALL_POLL_MS = 400;

/** După intrare ca apelant: ignoră `unreachable` până la acest moment (race ring ↔ DB / serverless). */
export const OUTGOING_CALL_INITIAL_GRACE_MS = 12_000;

/** După fiecare răspuns `ringing`: prelungește ignorarea `unreachable` (nu reseta la 0). */
export const OUTGOING_CALL_RINGING_EXTEND_MS = 8000;

/** Câte poll-uri consecutive `unreachable` înainte de a afișa ecranul terminal. */
export const OUTGOING_UNREACHABLE_CONSECUTIVE_POLLS = 2;

/** După 429 pe poll-uri call (outgoing-status, incoming): client nu mai lovește API-ul până atunci. */
export const CALL_POLL_429_BACKOFF_MS = 10_000;
