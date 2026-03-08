/**
 * Trimitere email prin Resend.
 * Pentru reset parolă: setează RESEND_API_KEY și RESEND_FROM_EMAIL în .env.
 */

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Align";

export interface SendPasswordResetOptions {
  to: string;
  resetLink: string;
  /** Minute până expiră linkul (doar pentru text) */
  expiresInMinutes?: number;
}

/**
 * Trimite email cu link de resetare parolă.
 * Returnează true dacă a fost trimis, false dacă Resend nu e configurat sau a eșuat.
 */
export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions
): Promise<boolean> {
  if (!resend) return false;

  const { to, resetLink, expiresInMinutes = 15 } = options;

  const subject = `Resetare parolă – ${APP_NAME}`;
  const html = `
    <p>Bună,</p>
    <p>Ai solicitat resetarea parolei pentru contul ${APP_NAME}.</p>
    <p>Apasă linkul de mai jos pentru a seta o parolă nouă (linkul expiră în ${expiresInMinutes} minute):</p>
    <p><a href="${resetLink}" style="color:#6366f1;text-decoration:underline">${resetLink}</a></p>
    <p>Dacă nu ai cerut resetarea, poți ignora acest email.</p>
    <p>— Echipa ${APP_NAME}</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
  });

  return !error;
}
