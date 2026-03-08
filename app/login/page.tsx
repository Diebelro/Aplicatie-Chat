"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthProviders from "@/components/AuthProviders";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

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

function getDisplayError(res: Response, data: { error?: string }): string {
  const msg = data.error ?? "Eroare la logare";
  if (res.status === 429) return "Prea multe încercări, încearcă mai târziu.";
  if (res.status === 404 || msg.includes("Nu există cont")) return "Nu există cont cu acest email. Înregistrează-te mai întâi sau verifică adresa.";
  if (res.status === 401 || msg.includes("Parolă") || msg.includes("incorectă")) return "Parolă incorectă. Încearcă din nou.";
  if (msg.includes("reCAPTCHA") || msg.includes("Verificarea")) return "Verificarea reCAPTCHA a eșuat.";
  if (msg.includes("suspect") || msg.includes("Activitate")) return "Activitate suspectă detectată.";
  return msg;
}

const AUTH_PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  facebook: "Facebook",
  phone: "Telefon (SMS)",
  yahoo: "Yahoo Mail",
};

export default function LoginPage() {
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

  useEffect(() => {
    const auth = searchParams.get("auth");
    const soon = searchParams.get("soon");
    if (soon === "1" && auth && AUTH_PROVIDER_NAMES[auth]) {
      setSoonMessage(`Autentificarea cu ${AUTH_PROVIDER_NAMES[auth]} va fi disponibilă în curând.`);
    }
  }, [searchParams]);

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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberDevice: rememberDevice,
          recaptchaToken: recaptchaToken || undefined,
          deviceFingerprint: getDeviceFingerprint() || undefined,
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      let data: { error?: string; user?: unknown; sessionType?: string; sessionToken?: string; deviceId?: string; profileComplete?: boolean } = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (text.trim().startsWith("<")) {
          setError("Serverul nu a răspuns corect. Verifică că serverul rulează (npm run dev) și încearcă din nou.");
          return;
        }
        try {
          data = JSON.parse(text);
        } catch {
          setError("Serverul nu a răspuns corect. Încearcă din nou.");
          return;
        }
      }
      if (!res.ok) {
        const displayMsg = getDisplayError(res, data);
        setError(displayMsg);
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const sec = parseInt(retryAfter, 10);
          const isSuspect = displayMsg.includes("suspect") || displayMsg.includes("Activitate");
          if (!Number.isNaN(sec) && sec > 0 && !isSuspect) setRetryAfterSeconds(sec);
        }
        return;
      }
      const userObj = data.user as { isBanned?: boolean } | undefined;
      if (userObj?.isBanned) {
        router.push("/cont-blocat");
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
      const profileComplete = data.profileComplete !== false;
      router.push(profileComplete ? "/app" : "/completeaza-profilul");
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
        <h1 className="text-2xl font-semibold text-white mt-4">Log in</h1>
        <p className="text-sm text-dark-300 mt-2">
          Introdu email-ul și parola cu care te-ai înregistrat.
        </p>
        <p className="text-sm text-dark-300 mt-2">
          Folosește email-ul și parola contului. Dacă nu ai cont, <Link href="/signup" className="text-brand-400 hover:underline">înregistrează-te</Link>.
        </p>
        <p className="text-sm text-dark-400 mt-1">
          Dacă ai repornit serverul (npm run dev), datele se pierd — creează cont din nou.
        </p>

        {soonMessage && (
          <p className="text-amber-400 text-sm mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {soonMessage}
          </p>
        )}

        <div className="mt-6">
          <AuthProviders compact />
        </div>

        <p className="text-sm text-dark-300 opacity-70 text-center mt-4">
          sau continuă cu email
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Parolă"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          {retryAfterSeconds > 0 && (
            <p className="text-dark-500 text-sm">Încearcă din nou în {retryAfterSeconds} secunde.</p>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500 shrink-0"
            />
            <span className="text-dark-500 text-sm">Ține-mă minte pe acest dispozitiv</span>
          </label>
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
          <button
            type="submit"
            disabled={loading || !acceptTerms || retryAfterSeconds > 0}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
          >
            {loading ? "Se conectează..." : retryAfterSeconds > 0 ? `Conectare (${retryAfterSeconds}s)` : "Conectare"}
          </button>
        </form>

        <p className="mt-6 text-center text-dark-500 text-sm">
          Nu ai cont?{" "}
          <Link href="/signup" className="text-brand-400 hover:underline">
            Înregistrare
          </Link>
        </p>
        <p className="mt-2 text-center text-dark-500 text-sm">
          <Link href="/forgot-password" className="text-brand-400 hover:underline">
            Ai uitat parola?
          </Link>
        </p>
      </div>
    </div>
  );
}
