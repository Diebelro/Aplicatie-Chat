/**
 * Trimitere email — standard Diebel: Zoho SMTP primar, Resend ca rezervă.
 * Un email se trimite O SINGURĂ DATĂ: Resend intră doar dacă SMTP nu e configurat
 * sau a eșuat înainte de a accepta mesajul.
 *
 * Variabile:
 * - ZOHO_SMTP_HOST (implicit smtppro.zoho.eu), ZOHO_SMTP_PORT (587 STARTTLS; 465 = TLS direct)
 * - ZOHO_SMTP_USER (implicit contact@diebel.ro), ZOHO_SMTP_PASSWORD — fără parolă, Zoho e dezactivat
 * - RESEND_API_KEY — cheie API Resend (începe cu re_)
 * - RESEND_FROM_EMAIL — expeditor pentru ambele canale; recomandat `Diebel <contact@diebel.ro>`
 */

import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getPublicAppUrl } from "@/lib/appUrl";

/** Adresa From implicită (domeniul trebuie verificat în Zoho și în Resend). */
export const RESEND_FROM_DEFAULT = "Diebel <contact@diebel.ro>";

function trimKey(key: string | undefined): string {
  return (key ?? "").trim();
}

/** Client Resend sau null dacă lipsește cheia. */
export function getResendClient(): Resend | null {
  const key = trimKey(process.env.RESEND_API_KEY);
  if (!key) return null;
  return new Resend(key);
}

/** Valoarea `from` (variabilă de mediu sau implicită) — comună pentru Zoho și Resend. */
export function getResendFromEmail(): string {
  const raw = trimKey(process.env.RESEND_FROM_EMAIL);
  return raw || RESEND_FROM_DEFAULT;
}

export function isZohoConfigured(): boolean {
  return trimKey(process.env.ZOHO_SMTP_PASSWORD).length > 0;
}

/** Există cel puțin un canal de email (Zoho sau Resend). Numele e păstrat pentru compatibilitate. */
export function isResendConfigured(): boolean {
  return isZohoConfigured() || getResendClient() != null;
}

let zohoTransport: Transporter | null = null;
function getZohoTransport(): Transporter | null {
  if (!isZohoConfigured()) return null;
  if (zohoTransport) return zohoTransport;
  const port = Number(trimKey(process.env.ZOHO_SMTP_PORT) || 587);
  zohoTransport = nodemailer.createTransport({
    host: trimKey(process.env.ZOHO_SMTP_HOST) || "smtppro.zoho.eu",
    port,
    secure: port === 465,
    auth: {
      user: trimKey(process.env.ZOHO_SMTP_USER) || "contact@diebel.ro",
      pass: trimKey(process.env.ZOHO_SMTP_PASSWORD),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return zohoTransport;
}

export type EmailDeliveryResult = {
  ok: boolean;
  provider?: "zoho" | "resend";
  id?: string;
  error?: string;
};

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * Livrare: Zoho SMTP (dacă e configurat) → la eșec, Resend. Un singur mesaj ajunge la destinatar.
 */
export async function deliverEmail(input: { to: string; subject: string; html: string }): Promise<EmailDeliveryResult> {
  const from = getResendFromEmail();
  const to = input.to.trim();
  const zoho = getZohoTransport();
  let zohoError: string | undefined;
  if (zoho) {
    try {
      const info = await zoho.sendMail({ from, to, subject: input.subject, html: input.html });
      return { ok: true, provider: "zoho", id: info.messageId };
    } catch (error) {
      zohoError = errorMessage(error);
      console.error("[email:zoho] eșuat, trec pe Resend:", zohoError);
    }
  }
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: zohoError ?? "Niciun canal de email configurat (ZOHO_SMTP_PASSWORD sau RESEND_API_KEY)." };
  }
  const { data, error } = await resend.emails.send({ from, to: [to], subject: input.subject, html: input.html });
  if (error) {
    const msg = errorMessage(error);
    console.error("[email:resend] eșuat:", msg);
    return { ok: false, provider: "resend", error: zohoError ? `${zohoError} | ${msg}` : msg };
  }
  return { ok: true, provider: "resend", id: data?.id };
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Diebel";

export interface SendPasswordResetOptions {
  to: string;
  resetLink: string;
  /** Minute până expiră linkul (doar pentru text) */
  expiresInMinutes?: number;
}

/**
 * Trimite email cu link de resetare parolă.
 * Returnează true dacă a fost trimis, false dacă niciun canal nu e configurat sau a eșuat.
 */
export async function sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<boolean> {
  if (!isResendConfigured()) return false;
  const { to, resetLink, expiresInMinutes = 15 } = options;

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

  const result = await deliverEmail({ to, subject, html });
  if (!result.ok) {
    console.error("[email:reset] Trimitere eșuată:", result.error);
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    console.info("[email:reset] trimis prin", result.provider, "id:", result.id ?? "(lipsește)", "| către:", to);
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
export async function sendEmailVerificationEmail(options: SendEmailVerificationOptions): Promise<boolean> {
  if (!isResendConfigured()) return false;
  const { to, verifyLink } = options;

  if (process.env.NODE_ENV === "development") {
    console.info("[email:verify] getPublicAppUrl() =", getPublicAppUrl(), "| link în mail:", verifyLink);
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

  const result = await deliverEmail({ to, subject, html });
  if (!result.ok) {
    console.error("[email:verify] Trimitere eșuată:", result.error);
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    console.info("[email:verify] trimis prin", result.provider, "id:", result.id ?? "(lipsește)", "| către:", to);
  }
  return true;
}

/**
 * Email simplu de test (diagnostic canal + domeniu).
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; id?: string; provider?: string; error?: string }> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Lipsește ZOHO_SMTP_PASSWORD sau RESEND_API_KEY în .env" };
  }
  const from = getResendFromEmail();
  const base = getPublicAppUrl();
  const sampleReset = `${base}/reset-password?token=EXEMPLU`;
  const sampleVerify = `${base}/verify-email?token=EXEMPLU`;
  const result = await deliverEmail({
    to,
    subject: `Test email – ${APP_NAME}`,
    html: `
      <p>Email de test la ${new Date().toISOString()}.</p>
      <p><strong>From:</strong> <code>${from}</code></p>
      <p><strong>getPublicAppUrl():</strong> <code>${base}</code></p>
      <p><strong>Exemplu link reset:</strong><br/><a href="${sampleReset}">${sampleReset}</a></p>
      <p><strong>Exemplu link verificare:</strong><br/><a href="${sampleVerify}">${sampleVerify}</a></p>
    `,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id, provider: result.provider };
}
