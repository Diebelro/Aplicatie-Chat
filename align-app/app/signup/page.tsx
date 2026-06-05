"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthProviders from "@/components/AuthProviders";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import { displayName } from "@/lib/displayName";
import { validateUsername } from "@/lib/usernameFormat";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import { PublicAuthPageLayout } from "@/components/PublicAuthPageLayout";
import { LegalAcceptCheckbox } from "@/components/LegalAcceptCheckbox";

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
  return w.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "signup" });
}

function SignUpContent() {
  const { tStr } = useI18n();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [emailCheck, setEmailCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");
  useEffect(() => {
    const e = searchParams?.get("email");
    if (e) setEmail(decodeURIComponent(e));
  }, [searchParams]);

  useEffect(() => {
    const validation = validateUsername(username);
    if (!validation.ok) {
      setUsernameCheck("idle");
      return;
    }
    const t = setTimeout(() => {
      setUsernameCheck("checking");
      fetch(`/api/check-username?value=${encodeURIComponent(validation.value)}`)
        .then((r) => r.json())
        .then((d) => setUsernameCheck(d.available ? "available" : "taken"))
        .catch(() => setUsernameCheck("idle"));
    }, 280);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    const raw = email.trim().toLowerCase();
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      setEmailCheck("idle");
      return;
    }
    const t = setTimeout(() => {
      setEmailCheck("checking");
      fetch(`/api/check-email?value=${encodeURIComponent(raw)}`)
        .then((r) => r.json())
        .then((d) => setEmailCheck(d.available ? "available" : "taken"))
        .catch(() => setEmailCheck("idle"));
    }, 280);
    return () => clearTimeout(t);
  }, [email]);

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 100;
  const maxYear18 = currentYear - 18; // cel târziu anul în care trebuie să te fi născut pentru 18 ani
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const t = setInterval(() => {
      setRetryAfterSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [retryAfterSeconds]);

  useEffect(() => {
    loadRecaptchaScript().catch(() => {});
  }, []);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: tStr(`common.months.${i + 1}`),
      })),
    [tStr]
  );

  function getBirthDateString(): string {
    if (!birthDay || !birthMonth || !birthYear) return "";
    const y = birthYear.padStart(4, "0");
    const m = birthMonth.padStart(2, "0");
    const d = birthDay.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function daysInMonth(month: string, year: string): number {
    if (!month || !year) return 31;
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
    return [4, 6, 9, 11].includes(m) ? 30 : 31;
  }

  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      const maxD = daysInMonth(birthMonth, birthYear);
      if (parseInt(birthDay, 10) > maxD) setBirthDay(String(maxD));
    }
  }, [birthMonth, birthYear]);

  /** Returnează true dacă data nașterii corespunde unei vârste de cel puțin 18 ani. */
  function isAtLeast18(dateStr: string): boolean {
    if (!dateStr || dateStr.length < 10) return false;
    const birth = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 18;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError(tStr("pages.signup.errPasswordShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(tStr("pages.signup.errPasswordMismatch"));
      return;
    }
    const birthDateStr = getBirthDateString();
    if (!birthDateStr) {
      setError(tStr("pages.signup.errBirthdate"));
      return;
    }
    if (!isAtLeast18(birthDateStr)) {
      setError(tStr("pages.signup.errAge"));
      return;
    }
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.ok) {
      const r = usernameValidation.reason;
      setError(
        tStr(
          r === "too_short"
            ? "pages.signup.usernameTooShort"
            : r === "too_long"
              ? "pages.signup.usernameTooLong"
              : "pages.signup.usernameInvalid"
        )
      );
      return;
    }
    if (usernameCheck === "taken") {
      setError(tStr("pages.signup.errUsernameTaken"));
      return;
    }
    if (!acceptLegal) {
      setError(tStr("pages.signup.errMustAcceptLegal"));
      return;
    }
    setLoading(true);
    try {
      const [recaptchaToken] = await Promise.all([
        getRecaptchaToken(),
        RECAPTCHA_SITE_KEY ? loadRecaptchaScript() : Promise.resolve(),
      ]);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          username: usernameValidation.value,
          password,
          gender: gender || undefined,
          birthDate: birthDateStr,
          rememberDevice: rememberDevice,
          recaptchaToken: recaptchaToken || undefined,
          deviceFingerprint: getDeviceFingerprint() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = String(data.error ?? "");
        const isSuspect = msg.includes("suspect") || msg.includes("Activitate");
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          if (retryAfter && !isSuspect) {
            const sec = parseInt(retryAfter, 10);
            if (!Number.isNaN(sec) && sec > 0) setRetryAfterSeconds(sec);
          }
          setError(tStr("pages.signup.errRateLimit"));
          return;
        }
        if (msg.includes("reCAPTCHA") || msg.includes("Verificarea")) {
          setError(tStr("pages.signup.errRecaptcha"));
          return;
        }
        if (isSuspect) {
          setError(tStr("pages.signup.errSuspicious"));
          return;
        }
        const trimmed = msg.trim();
        setError(trimmed ? translateApiErrorMessage(trimmed, tStr) || trimmed : tStr("pages.signup.errSignupGeneric"));
        return;
      }
      const storage = data.sessionType === "persistent" ? localStorage : sessionStorage;
      const other = data.sessionType === "persistent" ? sessionStorage : localStorage;
      storage.setItem("align_user", JSON.stringify(data.user));
      if (data.sessionToken) storage.setItem("align_session_token", data.sessionToken);
      if (data.deviceId) storage.setItem("align_device_id", data.deviceId);
      const fp = getDeviceFingerprint();
      if (fp) storage.setItem("align_device_fingerprint", fp);
      other.removeItem("align_user");
      other.removeItem("align_session_token");
      other.removeItem("align_device_id");
      other.removeItem("align_device_fingerprint");
      const { persistFullSiteConsent } = await import("@/lib/onboardingConsent");
      persistFullSiteConsent();
      window.location.href = "/onboarding/location";
    } catch (err) {
      setError(err instanceof Error ? err.message : tStr("pages.signup.errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicAuthPageLayout backLabel={tStr("pages.signup.backBrand")}>
      <div className="max-w-sm mx-auto w-full flex flex-col py-4 pb-8">
        <h1 className="ui-page-title text-2xl">{tStr("pages.signup.title")}</h1>
        <p className="ui-subtitle text-sm mt-2">
          {searchParams?.get("email") ? (
            <>
              <span className="text-brand-700 font-medium">{tStr("pages.signup.introPrefillTag")}</span>{" "}
              {tStr("pages.signup.introPrefillBody")}
            </>
          ) : (
            tStr("pages.signup.introDefault")
          )}
        </p>

        <div className="mt-6">
          <AuthProviders compact />
        </div>
        <p className="ui-helper-text text-center mt-2">{tStr("pages.signup.socialSoon")}</p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div>
            <label htmlFor="signup-email" className="ui-form-label block text-xs mb-1">
              {tStr("pages.signup.emailLabel")}
            </label>
            <input
              id="signup-email"
              type="email"
              placeholder={tStr("pages.signup.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {emailCheck === "available" && (
              <p className="text-green-400 text-xs mt-1">{tStr("pages.signup.emailFree")}</p>
            )}
            {emailCheck === "taken" && (
              <p className="text-red-400 text-xs mt-1">
                {tStr("pages.signup.emailTakenBefore")}{" "}
                <Link href="/login" className="underline">
                  {tStr("pages.signup.emailTakenLink")}
                </Link>
                {tStr("pages.signup.emailTakenAfter")}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="signup-username" className="ui-form-label block text-xs mb-1">
              {tStr("pages.signup.usernameLabel")}
            </label>
            <input
              id="signup-username"
              type="text"
              placeholder={tStr("pages.signup.usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              required
              minLength={2}
              maxLength={30}
              autoComplete="username"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-dark-500 text-xs mt-1">{tStr("pages.signup.usernameHelp")}</p>
            {usernameCheck === "available" && (
              <p className="text-green-400 text-xs mt-1">
                {formatTpl(tStr("pages.signup.usernameAvailable"), {
                  name: displayName(username.trim().toLowerCase()),
                })}
              </p>
            )}
            {usernameCheck === "taken" && (
              <p className="text-red-400 text-xs mt-1">{tStr("pages.signup.usernameTaken")}</p>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={tStr("pages.signup.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={rememberDevice ? "on" : "off"}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-zinc-900 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-zinc-900 transition p-1 rounded"
              aria-label={showPassword ? tStr("pages.signup.hidePassword") : tStr("pages.signup.showPassword")}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder={tStr("pages.signup.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={rememberDevice ? "on" : "off"}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-zinc-900 placeholder:text-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-zinc-900 transition p-1 rounded"
              aria-label={
                showConfirmPassword ? tStr("pages.signup.hidePassword") : tStr("pages.signup.showPassword")
              }
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div>
            <label className="ui-form-label block text-sm mb-1">{tStr("pages.signup.birthdateLabel")}</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="sr-only">{tStr("common.day")}</label>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  onBlur={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (v !== "") setBirthDay(v);
                  }}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">{tStr("common.day")}</option>
                  {Array.from({ length: daysInMonth(birthMonth, birthYear) }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">{tStr("common.month")}</label>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  onBlur={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (v !== "") setBirthMonth(v);
                  }}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">{tStr("common.month")}</option>
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">{tStr("common.year")}</label>
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  onBlur={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (v !== "") setBirthYear(v);
                  }}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">{tStr("common.year")}</option>
                  {Array.from({ length: maxYear18 - minYear + 1 }, (_, i) => maxYear18 - i).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-dark-500 text-xs mt-1">{tStr("pages.signup.birthdateHint")}</p>
          </div>
          <div>
            <label className="ui-form-label block text-sm mb-1">{tStr("pages.signup.genderLabel")}</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">{tStr("pages.signup.genderSelect")}</option>
              <option value="male">{tStr("pages.signup.genderMale")}</option>
              <option value="female">{tStr("pages.signup.genderFemale")}</option>
              <option value="other">{tStr("pages.signup.genderOther")}</option>
            </select>
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          {retryAfterSeconds > 0 && (
            <p className="text-dark-500 text-sm">{formatTpl(tStr("pages.signup.retryIn"), { n: retryAfterSeconds })}</p>
          )}
          <LegalAcceptCheckbox
            checked={acceptLegal}
            onChange={setAcceptLegal}
            lead={tStr("pages.signup.legalAcceptLead")}
            rulesLabel={tStr("pages.signup.legalAcceptRules")}
            mid={tStr("pages.signup.legalAcceptMid")}
            termsLabel={tStr("pages.signup.termsLink")}
            between={tStr("pages.signup.termsBetween")}
            privacyLabel={tStr("pages.signup.privacyLink")}
            andLabel={tStr("pages.signup.termsAnd")}
            cookiesLabel={tStr("pages.signup.cookiesLink")}
            end={tStr("pages.signup.legalAcceptEnd")}
          />
          <div className="mt-2 pt-2 border-t border-dark-600/60">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
              />
              <span className="text-dark-500 text-sm">{tStr("pages.signup.rememberDevice")}</span>
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !acceptLegal || retryAfterSeconds > 0}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading
              ? tStr("pages.signup.btnCreating")
              : retryAfterSeconds > 0
                ? formatTpl(tStr("pages.signup.btnCreateWait"), { n: retryAfterSeconds })
                : tStr("pages.signup.btnCreate")}
          </button>
        </form>

        <p className="mt-6 text-center text-dark-500 text-sm">
          {tStr("pages.signup.hasAccount")}{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            {tStr("pages.signup.loginLink")}
          </Link>
        </p>
      </div>
    </PublicAuthPageLayout>
  );
}

function SignupSuspenseFallback() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">
      {tStr("pages.signup.loading")}
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignupSuspenseFallback />}>
      <SignUpContent />
    </Suspense>
  );
}
