"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/OptimizedImage";

type Mode = "choose" | "email" | "email_sent" | "scan" | "scan_confirmed";

/** true pentru IP privat / localhost — dev Next e doar HTTP, https → eroare „conexiunea nu e privată”. */
function isPrivateOrLocalHost(hostname: string): boolean {
  if (hostname === "localhost") return true;
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

/** Baza URL pentru QR / link „recuperare pe telefon”. Pe telefon, localhost = telefonul, nu PC-ul. */
function mobileRecoverOrigin(): string {
  if (typeof window === "undefined") return "";
  let raw =
    process.env.NEXT_PUBLIC_MOBILE_RECOVER_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  if (!raw) return window.location.origin;
  try {
    const u = new URL(raw);
    if (u.protocol === "https:" && isPrivateOrLocalHost(u.hostname)) {
      u.protocol = "http:";
      return u.origin;
    }
  } catch {
    /* păstrăm raw */
  }
  return raw;
}

export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  /** Doar în `NODE_ENV=development`: link direct la /reset-password pe același host ca dev serverul. */
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la trimitere");
      setDevResetLink(typeof data.devResetLink === "string" ? data.devResetLink : null);
      setMode("email_sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  };

  const startRecoveryScan = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recovery-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare");
      setSessionId(data.sessionId);
      setQrToken(data.qrToken);
      if (typeof window !== "undefined") {
        const base = mobileRecoverOrigin();
        setQrUrl(
          `${base}/mobile/recover?token=${encodeURIComponent(data.qrToken)}`
        );
      }
      setMode("scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "scan" || !sessionId) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/recovery-status?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.status === "confirmed") {
          setMode("scan_confirmed");
          window.location.href = `/reset-password-via-scan?sessionId=${encodeURIComponent(sessionId)}`;
        } else if (data.status === "expired") {
          setError("Sesiunea a expirat. Încearcă din nou.");
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(t);
  }, [mode, sessionId]);

  if (mode === "email_sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Verifică emailul</h1>
          <p className="text-sm text-dark-300 mt-2">
            Am trimis un link la {email}.
          </p>
          <p className="text-sm text-dark-300 mt-2">
            Deschide linkul din email pentru a reseta parola. Verifică și dosarul de spam.
          </p>
          {devResetLink && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-left text-xs text-emerald-100/95 space-y-2">
              <p className="font-medium text-emerald-200">
                Mod local (development)
              </p>
              <p>
                Linkul din email duce la <strong>domeniul public al aplicației</strong> (ex.{" "}
                <strong>chat.diebel.ro</strong> — nu la <code className="text-emerald-300">localhost</code>). Pe
                producție e corect. Cutia asta apare doar la <code className="text-emerald-300">npm run dev</code>: ca
                să resetezi parola <strong>pe același PC</strong> fără să deschizi mailul pe chat live, folosește
                linkul de mai jos (expiră în ~15 minute).
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  href={devResetLink}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Deschide resetarea aici
                </a>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-emerald-500/50 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                  onClick={() => {
                    void navigator.clipboard.writeText(devResetLink).then(
                      () => {},
                      () => {
                        window.prompt("Copiază manual linkul:", devResetLink);
                      }
                    );
                  }}
                >
                  Copiază linkul
                </button>
              </div>
            </div>
          )}
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
            >
              Înapoi la Log in
            </Link>
          </div>
          <p className="mt-6 text-center text-dark-500 text-sm">
            <Link href="/login" className="text-brand-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (mode === "scan") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Recuperează prin scan</h1>
          <p className="text-sm text-dark-300 mt-2">
            Deschide aplicația Align pe telefon (sau acest site în browser pe telefon), fii logat, apoi scanează codul de mai jos sau deschide linkul.
          </p>
          <div className="mt-6 flex justify-center">
            <OptimizedImage
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
              alt="QR recuperare"
              width={200}
              height={200}
              priority
              className="w-[200px] h-[200px] rounded-xl border border-dark-600"
            />
          </div>
          <p className="text-sm text-dark-400 mt-4 text-center break-all">
            Sau deschide pe telefon: {qrUrl}
          </p>
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-left text-xs text-amber-100/95 space-y-2">
            <p className="font-medium text-amber-200">
              Chrome pe telefon poate schimba singur <strong>http://</strong> în <strong>https://</strong> la adrese IP
              → aceeași eroare „conexiunea nu e privată”, chiar dacă aici linkul e corect.
            </p>
            <p>
              <strong>Recomandat:</strong> lasă <code className="text-amber-300">npm run dev:lan</code> pornit, deschide
              un <strong>al doilea</strong> terminal în <code className="text-amber-300">align-app</code> și rulează{" "}
              <code className="text-amber-300">npm run tunnel:lt</code>. Copiază URL-ul <strong>https://…</strong> afișat
              și pune-l în <code className="text-amber-300">.env</code> la{" "}
              <code className="text-amber-300">NEXT_PUBLIC_MOBILE_RECOVER_ORIGIN=</code> (fără slash la final),
              repornește dev și generează din nou QR-ul. Prima deschidire pe telefon poate cere un click „Continue”
              pe pagina localtunnel — e normal.
            </p>
            <p className="text-dark-200">
              Alternativ: Chrome telefon → Setări → Confidențialitate → dezactivează „Folosește mereu conexiuni sigure” /
              HTTPS-First; sau încearcă <strong>Firefox</strong> pe telefon cu același link <strong>http://</strong>.
            </p>
          </div>
          <p className="text-sm text-dark-300 mt-4 text-center">
            Așteptăm confirmarea pe telefon…
          </p>
          {error && (
            <p className="text-red-400 text-sm mt-2 text-center">{error}</p>
          )}
          <Link
            href="/forgot-password"
            className="mt-6 text-center text-dark-500 text-sm hover:text-zinc-900"
          >
            Înapoi la opțiuni
          </Link>
        </div>
      </div>
    );
  }

  if (mode === "email") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            ← Align
          </Link>
          <button
            type="button"
            onClick={() => { setMode("choose"); setError(""); setDevResetLink(null); }}
            className="text-dark-400 text-sm mt-2"
          >
            ← Înapoi la opțiuni
          </button>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Trimite link pe email</h1>
          <p className="text-sm text-dark-300 mt-2">
            Introdu email-ul contului și îți trimitem un link pentru resetarea parolei.
          </p>
          <p className="text-sm text-dark-300 mt-2">
            Verifică și dosarul de spam dacă nu primești emailul.
          </p>

          <form onSubmit={handleEmailSubmit} className="space-y-4 mt-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition disabled:opacity-50"
            >
              {loading ? "Se trimite..." : "Trimite link de resetare"}
            </button>
          </form>

          <p className="mt-6 text-center text-dark-500 text-sm">
            Înapoi la{" "}
            <Link href="/login" className="text-brand-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <Link href="/login" className="inline-block text-brand-400 font-bold">
          ← Align
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-4">Ai uitat parola?</h1>
        <p className="text-sm text-dark-300 mt-2">
          Alege cum vrei să recuperezi contul:
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setMode("email"); setDevResetLink(null); }}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl border border-dark-600 bg-dark-800 hover:bg-dark-700 text-zinc-900 font-medium text-sm transition flex items-center justify-center"
          >
            Trimite link pe email
          </button>
          <button
            type="button"
            onClick={startRecoveryScan}
            disabled={loading}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl border border-brand-500/50 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-medium text-sm transition flex items-center justify-center disabled:opacity-50"
          >
            {loading ? "Se pregătește..." : "Recuperează prin scan cu telefonul"}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-4">{error}</p>
        )}

        <p className="mt-6 text-center text-dark-500 text-sm">
          Înapoi la{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
