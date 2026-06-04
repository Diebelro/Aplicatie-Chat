/**
 * Intervale client pentru producție pe VPS (chat.diebel.ro + ws.diebel.ro).
 * Un singur loc — la schimbări, deploy pe server; nu depinde de Vercel.
 */
/** Prezență online (POST /api/heartbeat) — tab vizibil. */
export const VPS_HEARTBEAT_MS = 3000;

/** Badge necitite + apeluri pierdute în shell-ul /app. */
export const VPS_UNREAD_MISS_POLL_MS = 1500;

/** Notificare match nou în nav. */
export const VPS_MATCHES_POLL_MS = 12_000;

/** Listă conversații + prieteni (/app/messages). */
export const VPS_MESSAGES_LIST_POLL_MS = 900;

/** Mesaje active în chat 1-la-1. */
export const VPS_CHAT_MESSAGES_POLL_MS = 1000;

/** Overlay „te sună” — tab vizibil. */
export const VPS_INCOMING_CALL_POLL_VISIBLE_MS = 500;

/** Overlay „te sună” — tab ascuns. */
export const VPS_INCOMING_CALL_POLL_HIDDEN_MS = 4000;

/** Debounce golire incoming după null de la server. */
export const VPS_INCOMING_CLEAR_DEBOUNCE_MS = 1200;
