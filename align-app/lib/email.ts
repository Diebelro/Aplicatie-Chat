/**
 * Trimitere email prin Resend (https://resend.com).
 *
 * Variabile:
 * - RESEND_API_KEY — cheie API (începe cu re_)
 * - RESEND_FROM_EMAIL — expeditor; pentru domeniul tău: verifică diebel.ro în Resend → Domains.
 *   Format recomandat: `Align <contact@diebel.ro>` (adresa efectivă = contact@diebel.ro).
 */

import { Resend } from "resend";
import { getPublicAppUrl } from "@/lib/appUrl";

/** Adresa From implicită dacă nu setezi RESEND_FROM_EMAIL (domeniul trebuie Verified în Resend). */
export const RESEND_FROM_DEFAULT = "Align <contact@diebel.ro>";

function trimKey(key: string | undefined): string {
  return (key ?? "").trim();
}

/** Client Resend sau null dacă lipsește cheia. */
export function getResendClient(): Resend | null {
  const key = trimKey(process.env.RESEND_API_KEY);
  if (!key) return null;
  return new Resend(key);
}

/** Valoarea `from` trimisă la Resend (variabilă de mediu sau implicită). */
export function getResendFromEmail(): string {
  const raw = trimKey(process.env.RESEND_FROM_EMAIL);
  return raw || RESEND_FROM_DEFAULT;
}

export function isResendConfigured(): boolean {
  return getResendClient() != null;
}

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
  const resend = getResendClient();
  if (!resend) return false;

  const { to, resetLink, expiresInMinutes = 15 } = options;
  const from = getResendFromEmail();

  if (process.env.NODE_ENV === "development") {
    console.info("[email:reset] getPublicAppUrl() =", getPublicAppUrl(), "| link în mail:", resetLink);
  }

  const subject = `Resetare parolă – ${APP_NAME}`;
  const html = `
    <p>Bună,</p>
    <p>Ai solicitat resetarea parolei pentru contul ${APP_NAME}.</p>
    <p>Apasă linkul de mai jos pentru a seta o parolă nouă (linkul expiră în ${expiresInMinutes} minute):</p>
    <p><a href="${resetLink}" style="color:#6366f1;text-decoration:underline">${resetLink}</a></p>
    <p>Dacă nu ai cerut resetarea, poți ignora acest email.</p>
    <p>— Echipa ${APP_NAME}</p>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("[Resend] Trimitere email eșuată:", JSON.stringify(error, null, 2));
    return false;
  }

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[Resend] API a acceptat trimiterea. id:",
      data?.id ?? "(lipsește)",
      "| către:",
      to,
      "| de la:",
      from
    );
  }

  return true;
}

export interface SendEmailVerificationOptions {
  to: string;
  verifyLink: string;
}

/**
 * Email la înregistrare: confirmă adresa.
 */
export async function sendEmailVerificationEmail(
  options: SendEmailVerificationOptions
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  const { to, verifyLink } = options;
  const from = getResendFromEmail();

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[email:verify] getPublicAppUrl() =",
      getPublicAppUrl(),
      "| link în mail:",
      verifyLink
    );
  }

  const subject = `Confirmă adresa de email – ${APP_NAME}`;
  const html = `
    <p>Bună,</p>
    <p>Mulțumim că te-ai înregistrat la ${APP_NAME}.</p>
    <p>Apasă linkul de mai jos pentru a confirma adresa de email:</p>
    <p><a href="${verifyLink}" style="color:#6366f1;text-decoration:underline">${verifyLink}</a></p>
    <p>Dacă nu ai creat tu acest cont, poți ignora acest mesaj.</p>
    <p>— Echipa ${APP_NAME}</p>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("[Resend] Verificare email eșuată:", JSON.stringify(error, null, 2));
    return false;
  }

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[Resend] Email verificare trimis. id:",
      data?.id ?? "(lipsește)",
      "| către:",
      to,
      "| de la:",
      from
    );
  }

  return true;
}

/**
 * Email simplu de test (diagnostic Resend + domeniu).
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: "Lipsește RESEND_API_KEY în .env" };
  }

  const from = getResendFromEmail();
  const base = getPublicAppUrl();
  const sampleReset = `${base}/reset-password?token=EXEMPLU`;
  const sampleVerify = `${base}/verify-email?token=EXEMPLU`;
  const { data, error } = await resend.emails.send({
    from,
    to: [to.trim()],
    subject: `Test Resend – ${APP_NAME}`,
    html: `
      <p>Email de test la ${new Date().toISOString()}.</p>
      <p><strong>From:</strong> <code>${from}</code></p>
      <p><strong>getPublicAppUrl():</strong> <code>${base}</code></p>
      <p><strong>Exemplu link reset:</strong><br/><a href="${sampleReset}">${sampleReset}</a></p>
      <p><strong>Exemplu link verificare:</strong><br/><a href="${sampleVerify}">${sampleVerify}</a></p>
    `,
  });

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error);
    console.error("[Resend] Test eșuat:", error);
    return { ok: false, error: msg };
  }

  return { ok: true, id: data?.id };
}
