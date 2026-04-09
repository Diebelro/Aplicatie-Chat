/**
 * Cât timp poate rămâne un apel în starea „sună” pe server dacă nu se începe convorbirea.
 * După această durată, poll-ul callee șterge pending-ul (apelantul a închis fereastra / nu mai e activ).
 */
export const RING_PENDING_MAX_MS = 3 * 60 * 1000;

/** Callee a respins — semnal pentru apelant (poll outgoing-status). Aliniat cu store.REJECTED_EXPIRE_MS. */
export const REJECTED_CALL_ROOM_TTL_MS = 2 * 60 * 1000;
