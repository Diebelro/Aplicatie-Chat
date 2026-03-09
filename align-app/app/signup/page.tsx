"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthProviders from "@/components/AuthProviders";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import { displayName } from "@/lib/displayName";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");
  useEffect(() => {
    const e = searchParams.get("email");
    if (e) setEmail(decodeURIComponent(e));
  }, [searchParams]);

  useEffect(() => {
    if (!username.trim() || username.length < 2) {
      setUsernameCheck("idle");
      return;
    }
    const t = setTimeout(() => {
      setUsernameCheck("checking");
      fetch(`/api/check-username?value=${encodeURIComponent(username.trim())}`)
        .then((r) => r.json())
        .then((d) => setUsernameCheck(d.available ? "available" : "taken"))
        .catch(() => setUsernameCheck("idle"));
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

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
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
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

  const MONTHS: { value: string; label: string }[] = [
    { value: "1", label: "Ianuarie" }, { value: "2", label: "Februarie" }, { value: "3", label: "Martie" },
    { value: "4", label: "Aprilie" }, { value: "5", label: "Mai" }, { value: "6", label: "Iunie" },
    { value: "7", label: "Iulie" }, { value: "8", label: "August" }, { value: "9", label: "Septembrie" },
    { value: "10", label: "Octombrie" }, { value: "11", label: "Noiembrie" }, { value: "12", label: "Decembrie" },
  ];

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
      setError("Parola trebuie să aibă cel puțin 6 caractere.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }
    const birthDateStr = getBirthDateString();
    if (!birthDateStr) {
      setError("Selectează ziua, luna și anul nașterii.");
      return;
    }
    if (!isAtLeast18(birthDateStr)) {
      setError("Trebuie să ai cel puțin 18 ani pentru a crea un cont.");
      return;
    }
    if (!username.trim()) {
      setError("Introdu un username (litere, cifre, punct, liniuță jos).");
      return;
    }
    if (usernameCheck === "taken") {
      setError("Acest username este deja folosit.");
      return;
    }
    if (!acceptTerms) {
      setError("Trebuie să accepți Termenii și Politica de Confidențialitate.");
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
          username: username.trim(),
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
        const msg = data.error || "Eroare la înregistrare";
        const isSuspect = msg.includes("suspect") || msg.includes("Activitate");
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          if (retryAfter && !isSuspect) {
            const sec = parseInt(retryAfter, 10);
            if (!Number.isNaN(sec) && sec > 0) setRetryAfterSeconds(sec);
          }
          setError("Prea multe încercări, încearcă mai târziu.");
          return;
        }
        if (msg.includes("reCAPTCHA") || msg.includes("Verificarea")) {
          setError("Verificarea reCAPTCHA a eșuat.");
          return;
        }
        if (isSuspect) {
          setError("Activitate suspectă detectată.");
          return;
        }
        setError(msg);
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
      router.push("/onboarding/location");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <Link href="/" className="inline-block text-brand-400 font-bold">
          ← Align
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-4">Creează cont</h1>
        <p className="text-sm text-dark-300 mt-2">
          La înregistrare completezi email, parolă, data nașterii (min. 18 ani) și genul. Numele, orașul și restul le completezi mai târziu din „Completează profilul”.
        </p>
        {searchParams.get("email") && (
          <p className="text-brand-400/90 text-sm mt-2">
            Reconectare după repornire server: email-ul e deja completat, introdu parola și apasă Creează cont.
          </p>
        )}

        <div className="mt-6">
          <AuthProviders compact />
        </div>

        <p className="text-sm text-dark-300 opacity-70 text-center mt-4">
          sau continuă cu email
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label htmlFor="signup-email" className="block text-xs text-dark-400 mb-1">Email</label>
            <input
              id="signup-email"
              type="email"
              placeholder="ex: nume@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="signup-username" className="block text-xs text-dark-400 mb-1">Username (nu email-ul — ex: ana_maria)</label>
            <input
              id="signup-username"
              type="text"
              placeholder="ex: ana_maria"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              required
              minLength={2}
              maxLength={30}
              autoComplete="username"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {usernameCheck === "available" && <p className="text-green-400 text-xs mt-1">{displayName(username.trim().toLowerCase())} este disponibil</p>}
            {usernameCheck === "taken" && <p className="text-red-400 text-xs mt-1">Acest username este folosit. Alege altul (ex: ana_maria2).</p>}
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Parolă (min. 6 caractere)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={rememberDevice ? "on" : "off"}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white transition p-1 rounded"
              aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirmă parola"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={rememberDevice ? "on" : "off"}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white transition p-1 rounded"
              aria-label={showConfirmPassword ? "Ascunde parola" : "Arată parola"}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div>
            <label className="block text-dark-500 text-sm mb-1">Data nașterii</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="sr-only">Zi</label>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Zi</option>
                  {Array.from({ length: daysInMonth(birthMonth, birthYear) }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">Lună</label>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Lună</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sr-only">An</label>
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">An</option>
                  {Array.from({ length: maxYear18 - minYear + 1 }, (_, i) => maxYear18 - i).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-dark-500 text-xs mt-1">Trebuie să ai cel puțin 18 ani.</p>
          </div>
          <div>
            <label className="block text-dark-500 text-sm mb-1">Gen</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Alege genul</option>
              <option value="male">Bărbat</option>
              <option value="female">Femeie</option>
              <option value="other">Altul</option>
            </select>
          </div>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          {retryAfterSeconds > 0 && (
            <p className="text-dark-500 text-sm">Încearcă din nou în {retryAfterSeconds} secunde.</p>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
            />
            <span className="text-dark-500 text-xs">
              Prin continuare, ești de acord cu{" "}
              <Link href="/terms" className="text-brand-400 hover:underline">Termenii</Link>
              {" "}și{" "}
              <Link href="/privacy" className="text-brand-400 hover:underline">Politica de Confidențialitate</Link>.
            </span>
          </label>
          <div className="mt-2 pt-2 border-t border-dark-600/60">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
              />
              <span className="text-dark-500 text-sm">Ține-mă minte pe acest dispozitiv</span>
            </label>
          </div>
          <button
            type="submit"
            disabled={loading || !acceptTerms || retryAfterSeconds > 0}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Se creează..." : retryAfterSeconds > 0 ? `Creează cont (${retryAfterSeconds}s)` : "Creează cont"}
          </button>
        </form>

        <p className="mt-6 text-center text-dark-500 text-sm">
          Ai deja cont?{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">Se încarcă...</div>}>
      <SignUpContent />
    </Suspense>
  );
}
