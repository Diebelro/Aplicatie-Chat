/**
 * Verify reCAPTCHA v3 (invisible).
 * Set in .env: NEXT_PUBLIC_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY
 */

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export type RecaptchaResult = {
  success: boolean;
  score?: number;
  action?: string;
  errorCodes?: string[];
};

export async function verifyRecaptchaV3(token: string, expectedAction = "signup"): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { success: true, score: 1 };
  }
  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: "",
      }),
    });
    const data = (await res.json()) as {
      success: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };
    return {
      success: data.success === true,
      score: data.score,
      action: data.action,
      errorCodes: data["error-codes"],
    };
  } catch {
    return { success: false };
  }
}

export const RECAPTCHA_SUSPECT_THRESHOLD = 0.3;
