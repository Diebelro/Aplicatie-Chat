"use client";

export const dynamic = "force-dynamic";
import { Suspense, useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthProviders from "@/components/AuthProviders";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import { clearLoginEmailDraft, readLoginEmailDraft, writeLoginEmailDraft } from "@/lib/formDrafts";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined" || !RECAPTCHA_SITE_KEY) return Promise.resolve();
  const w = window as unknown as { grecaptcha?: { ready: (fn: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> } };
  if (w.grecaptcha) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.onload = () => {
      w.grecaptcha?.ready(() => resolve());
    };
    script.onerror = () => reject(new Error("reCAPTCHA load failed"));
    document.head.appendChild(script);
  });
}

function getRecaptchaToken(): Promise<string> {
  if (typeof window === "undefined" || !RECAPTCHA_SITE_KEY) return Promise.resolve("");
  const w = window as unknown as { grecaptcha?: { execute: (key: string, opts: { action: string }) => Promise<string> } };
  if (!w.grecaptcha) return Promise.resolve("");
  return w.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "login" });
}

const LAST_EMAIL_KEY = "align_last_email";
const PREFILL_KEYS_TO_CLEAN = ["username", "identifier", "align_username", "align_identifier"];

const LOGIN_PROVIDER_KEYS: Record<string, string> = {
  google: "pages.login.providerGoogle",
  apple: "pages.login.providerApple",
  microsoft: "pages.login.providerMicrosoft",
  facebook: "pages.login.providerFacebook",
  phone: "pages.login.providerPhone",
  yahoo: "pages.login.providerYahoo",
};

function loginProviderLabel(p: string, tStr: (path: string) => string): string {
  const path = LOGIN_PROVIDER_KEYS[p];
  return path ? tStr(path) : p;
}

function getLoginDisplayError(res: Response, data: { error?: string }, tStr: (path: string) => string): string {
  const msg = String(data.error ?? "");
  if (res.status === 429) return tStr("pages.login.errRateLimit");
  if (msg.includes("Introdu emailul") || msg.includes("username-ul")) return tStr("pages.login.errUseEmailNotUsername");
  if (res.status === 404 || msg.includes("Nu există cont")) return tStr("pages.login.errNoAccount");
  if (res.status === 401 || msg.includes("Parolă") || msg.includes("incorectă")) return tStr("pages.login.errBadCredentials");
  if (msg.includes("reCAPTCHA") || msg.includes("Verificarea")) return tStr("pages.login.errRecaptcha");
  if (msg.includes("suspect") || msg.includes("Activitate")) return tStr("pages.login.errSuspicious");
  const trimmed = msg.trim();
  if (trimmed) {
    const tr = translateApiErrorMessage(trimmed, tStr);
    if (tr && tr !== trimmed) return tr;
    return trimmed;
  }
  return tStr("pages.login.errLoginGeneric");
}

function LoginContent() {
  const { tStr } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soonMessage, setSoonMessage] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const loc = window.localStorage;
      const ses = window.sessionStorage;
      PREFILL_KEYS_TO_CLEAN.forEach((k) => {
        loc.removeItem(k);
        ses.removeItem(k);
      });
      const draft = readLoginEmailDraft();
      if (draft.length > 0) {
        setEmail(draft);
        return;
      }
      const last = loc.getItem(LAST_EMAIL_KEY);
      if (last != null && !String(last).trim().includes("@")) {
        loc.removeItem(LAST_EMAIL_KEY);
        ses.removeItem(LAST_EMAIL_KEY);
      }
      const lastTrim = last != null ? String(last).trim() : "";
      if (lastTrim.includes("@")) setEmail((prev) => (prev ? prev : lastTrim));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => writeLoginEmailDraft(email), 350);
    return () => clearTimeout(t);
  }, [email]);

  useEffect(() => {
    const auth = searchParams?.get("auth");
    const soon = searchParams?.get("soon");
    const reason = searchParams?.get("reason");
    const p = searchParams?.get("p");
    if (reason === "session_expired") {
      setSoonMessage(tStr("pages.login.sessionExpired"));
    } else if (reason === "oauth_failed") {
      setSoonMessage(tStr("pages.login.oauthFailed"));
    } else if (reason === "oauth_no_db") {
      setSoonMessage(tStr("pages.login.oauthNoDb"));
    } else if (reason === "oauth_not_configured" && p && LOGIN_PROVIDER_KEYS[p]) {
      setSoonMessage(formatTpl(tStr("pages.login.oauthNotConfigured"), { provider: loginProviderLabel(p, tStr) }));
    } else if (soon === "1" && auth && LOGIN_PROVIDER_KEYS[auth]) {
      setSoonMessage(formatTpl(tStr("pages.login.oauthSoon"), { provider: loginProviderLabel(auth, tStr) }));
    }
  }, [searchParams, tStr]);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const t = setInterval(() => {
      setRetryAfterSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [retryAfterSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRetryAfterSeconds(0);
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes("@")) {
      setError(tStr("pages.login.errEmailNotUsername"));
      return;
    }
    if (!acceptTerms) {
      setError(tStr("pages.login.errMustAcceptTerms"));
      return;
    }
    setLoading(true);
    try {
      const [recaptchaToken] = await Promise.all([
        getRecaptchaToken(),
        RECAPTCHA_SITE_KEY ? loadRecaptchaScript() : Promise.resolve(),
      ]);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
            rememberDevice: rememberDevice,
            recaptchaToken: recaptchaToken || undefined,
            deviceFingerprint: getDeviceFingerprint() || undefined,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          setError(tStr("pages.login.errTimeout"));
          return;
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
      const contentType = res.headers.get("content-type") ?? "";
      let data: { error?: string; user?: unknown; sessionType?: string; sessionToken?: string; deviceId?: string; profileComplete?: boolean } = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (text.trim().startsWith("<")) {
          setError(
            process.env.NODE_ENV === "development" ? tStr("pages.login.errUnexpectedDev") : tStr("pages.login.errUnexpected")
          );
          return;
        }
        try {
          data = JSON.parse(text);
        } catch {
          setError(tStr("pages.login.errUnexpected"));
          return;
        }
      }
      if (!res.ok) {
        const rawErr = String(data.error ?? "");
        const displayMsg = getLoginDisplayError(res, data, tStr);
        setError(displayMsg);
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const sec = parseInt(retryAfter, 10);
          const isSuspect =
            rawErr.toLowerCase().includes("suspect") || rawErr.includes("Activitate");
          if (!Number.isNaN(sec) && sec > 0 && !isSuspect) setRetryAfterSeconds(sec);
        }
        return;
      }
      const userObj = data.user as { isBanned?: boolean; email?: string; banUntil?: string | null } | undefined;
      if (userObj?.isBanned) {
        const q = new URLSearchParams();
        if (trimmedEmail) q.set("email", trimmedEmail);
        if (userObj.banUntil) q.set("until", userObj.banUntil);
        const qs = q.toString();
        router.push("/cont-blocat" + (qs ? "?" + qs : ""));
        return;
      }
      const storage = data.sessionType === "persistent" ? localStorage : sessionStorage;
      const other = data.sessionType === "persistent" ? sessionStorage : localStorage;
      storage.setItem("align_user", JSON.stringify(data.user));
      if (data.sessionToken) storage.setItem("align_session_token", data.sessionToken);
      if (data.deviceId) storage.setItem("align_device_id", data.deviceId);
      const fp = getDeviceFingerprint();
      if (fp) storage.setItem("align_device_fingerprint", fp);
      if (data.sessionType === "persistent" && trimmedEmail) {
        try {
          localStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
        } catch {
          // ignore
        }
      }
      clearLoginEmailDraft();
      other.removeItem("align_user");
      other.removeItem("align_session_token");
      other.removeItem("align_device_id");
      other.removeItem("align_device_fingerprint");
      const profileComplete = data.profileComplete !== false;
      const redirectTo = searchParams?.get("redirect");
      const safeRedirect = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;
      const target = safeRedirect ?? (profileComplete ? "/app" : "/completeaza-profilul");
      // DEV ONLY: allow browser time to persist Set-Cookie before redirect
      await new Promise((r) => setTimeout(r, 500));
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : tStr("pages.login.errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-dark-900">
      <div className="shrink-0 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-brand-400 hover:text-brand-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          {tStr("pages.login.backBrand")}
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] min-h-0 min-w-0">
        <div className="w-full max-w-[min(100%,24rem)] mx-auto flex flex-col gap-4 sm:gap-5 min-w-0">
          <header className="text-center space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-400/90">Align</p>
            <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">{tStr("pages.login.title")}</h1>
            <p className="text-sm text-dark-300 leading-relaxed">{tStr("pages.login.introHero")}</p>
          </header>

          {soonMessage && (
            <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-center">
              {soonMessage}
            </p>
          )}

          <div className="w-full min-w-0 mx-auto shrink-0">
            <AuthProviders variant="loginHero" />
          </div>

          <div className="flex items-center gap-3 py-0.5" aria-hidden>
            <span className="h-px flex-1 bg-dark-600 min-w-0" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-dark-500 shrink-0">
              {tStr("pages.login.dividerEmail")}
            </span>
            <span className="h-px flex-1 bg-dark-600 min-w-0" />
          </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="login-email" className="block text-sm font-medium text-dark-300">
            {tStr("pages.login.emailLabel")}
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder={tStr("pages.login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={tStr("pages.login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-zinc-100 placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-zinc-900 transition p-1 rounded"
              aria-label={showPassword ? tStr("pages.login.hidePassword") : tStr("pages.login.showPassword")}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && (
            <p
              className="text-red-300 text-sm rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 break-words"
              role="alert"
            >
              {error}
            </p>
          )}
          {retryAfterSeconds > 0 && (
            <p className="text-dark-500 text-sm">{formatTpl(tStr("pages.login.retryIn"), { n: retryAfterSeconds })}</p>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
            />
            <span className="text-dark-500 text-sm">{tStr("pages.login.rememberDevice")}</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
            />
            <span className="text-dark-500 text-xs">
              {tStr("pages.login.termsLead")}
              <Link href="/terms" className="text-brand-400 hover:underline">
                {tStr("pages.login.termsLink")}
              </Link>
              {tStr("pages.login.termsBetween")}
              <Link href="/privacy" className="text-brand-400 hover:underline">
                {tStr("pages.login.privacyLink")}
              </Link>
              {tStr("pages.login.termsAnd")}
              <Link href="/cookies" className="text-brand-400 hover:underline">
                {tStr("pages.login.cookiesLink")}
              </Link>
              {tStr("pages.login.termsEnd")}
            </span>
          </label>
          <button
            type="submit"
            disabled={loading || retryAfterSeconds > 0}
            className="w-full min-h-[48px] px-4 rounded-xl bg-brand-500 hover:bg-brand-400 active:bg-brand-500/90 text-dark-900 font-semibold text-sm transition disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
          >
            {loading
              ? tStr("pages.login.btnConnecting")
              : retryAfterSeconds > 0
                ? formatTpl(tStr("pages.login.btnConnectWait"), { n: retryAfterSeconds })
                : tStr("pages.login.btnConnect")}
          </button>
        </form>

          <p className="text-center text-dark-400 text-sm">
            {tStr("pages.login.noAccount")}{" "}
            <Link href="/signup" className="font-medium text-brand-400 hover:text-brand-300 hover:underline">
              {tStr("home.signup")}
            </Link>
          </p>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-brand-400/90 hover:text-brand-300 hover:underline">
              {tStr("pages.login.forgotPassword")}
            </Link>
          </p>

          <nav className="flex flex-col items-center gap-3 pt-1" aria-label="Legal">
            <Link
              href="/privacy"
              className="text-sm font-semibold text-brand-400 hover:text-brand-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
            >
              Privacy Policy
            </Link>
            <p className="text-center text-dark-600 text-[11px] leading-relaxed flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
              <Link href="/terms" className="text-brand-400/80 hover:underline">
                {tStr("pages.login.footerTerms")}
              </Link>
              <span className="text-dark-600 select-none" aria-hidden>
                ·
              </span>
              <Link href="/cookies" className="text-brand-400/80 hover:underline">
                {tStr("pages.login.footerCookies")}
              </Link>
            </p>
          </nav>
        </div>
      </div>
    </div>
  );
}

function LoginSuspenseFallback() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">
      {tStr("pages.login.loading")}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSuspenseFallback />}>
      <LoginContent />
    </Suspense>
  );
}
