/**
 * Cât timp poate rămâne un apel în starea „sună” pe server dacă nu se începe convorbirea.
 * După această durată, poll-ul callee șterge pending-ul (apelantul a închis fereastra / nu mai e activ).
 */
export const RING_PENDING_MAX_MS = 3 * 60 * 1000;
