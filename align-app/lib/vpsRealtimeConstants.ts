/**
 * Intervale client pentru producție pe VPS (chat.diebel.ro + ws.diebel.ro).
 * Un singur loc — la schimbări, deploy pe server; nu depinde de Vercel.
 * Valori agresive pentru reacție „fulger” (tab vizibil); poll-ul se oprește când tab-ul e ascuns.
 */
/** Prezență online (POST /api/heartbeat) — tab vizibil. */
export const VPS_HEARTBEAT_MS = 2500;

/** Badge necitite + apeluri pierdute în shell-ul /app. */
export const VPS_UNREAD_MISS_POLL_MS = 600;

/** Notificare match nou în nav. */
export const VPS_MATCHES_POLL_MS = 8000;

/** Listă conversații + prieteni (/app/messages). */
export const VPS_MESSAGES_LIST_POLL_MS = 400;

/** Mesaje active în chat 1-la-1. */
export const VPS_CHAT_MESSAGES_POLL_MS = 400;

/** Overlay „te sună” — tab vizibil. */
export const VPS_INCOMING_CALL_POLL_VISIBLE_MS = 250;

/** Overlay „te sună” — tab ascuns. */
export const VPS_INCOMING_CALL_POLL_HIDDEN_MS = 2500;

/** Debounce golire incoming după null de la server. */
export const VPS_INCOMING_CLEAR_DEBOUNCE_MS = 500;

/** Retrimite „citit” în chat activ (bife rapide la destinatar). */
export const VPS_CHAT_READ_RESEND_MS = 5000;
