/**
 * Limite / zone fără test automat complet — utile pentru QA și review intern.
 * Nu se afișează utilizatorilor finali; panoul Admin → Bord sistem le listează.
 */
export const PRODUCTION_UX_GAPS: readonly string[] = [
  "Apeluri WebRTC: bordul verifică variabilele de mediu și HTTP /health la semnalizare; nu înlocuiește test manual cu două dispozitive (Wi‑Fi + date mobile, CGNAT).",
  "Calitate apel (video/audio): depinde de TURN, firewall și permisiuni microfon/cameră pe dispozitiv — urmărește și docs/calls.md.",
  "Login cu telefon (SMS): în UI poate apărea flux „în curând”; înainte de Play verifică dacă e activ în producție și funcțional.",
] as const;
