"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/components/OptimizedImage";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

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

function authErr(msg: string, tStr: (path: string) => string, genericPath: string): string {
  return translateApiErrorMessage(msg, tStr) || msg || tStr(genericPath);
}

export default function ForgotPasswordPage() {
  const { tStr } = useI18n();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
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
      const msg = err instanceof Error ? err.message : "";
      setError(authErr(msg, tStr, "pages.forgotPassword.errGeneric"));
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
      if (typeof window !== "undefined") {
        const base = mobileRecoverOrigin();
        setQrUrl(
          `${base}/mobile/recover?token=${encodeURIComponent(data.qrToken)}`
        );
      }
      setMode("scan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const shown =
        translateApiErrorMessage(msg, tStr) ||
        (msg === "Eroare" ? tStr("pages.forgotPassword.errRecovery") : msg) ||
        tStr("pages.forgotPassword.errGeneric");
      setError(shown);
    } finally {
      setLoading(false);
    }
  }, [tStr]);

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
          setError(tStr("pages.forgotPassword.sessionExpired"));
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(t);
  }, [mode, sessionId, tStr]);

  if (mode === "email_sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
        <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
          <Link href="/login" className="inline-block text-brand-400 font-bold">
            {tStr("pages.forgotPassword.backBrand")}
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.forgotPassword.emailSentTitle")}</h1>
          <p className="text-sm text-dark-300 mt-2">
            {formatTpl(tStr("pages.forgotPassword.emailSentLine1"), { email })}
          </p>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.forgotPassword.emailSentLine2")}
          </p>
          {devResetLink && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-left text-xs text-emerald-100/95 space-y-2">
              <p className="font-medium text-emerald-200">
                {tStr("pages.forgotPassword.devTitle")}
              </p>
              <p>
                {tStr("pages.forgotPassword.devP1")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  href={devResetLink}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  {tStr("pages.forgotPassword.devOpenReset")}
                </a>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-emerald-500/50 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
                  onClick={() => {
                    void navigator.clipboard.writeText(devResetLink).then(
                      () => {},
                      () => {
                        window.prompt(tStr("pages.forgotPassword.devCopyPrompt"), devResetLink);
                      }
                    );
                  }}
                >
                  {tStr("pages.forgotPassword.devCopy")}
                </button>
              </div>
            </div>
          )}
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
            >
              {tStr("pages.forgotPassword.backLoginCta")}
            </Link>
          </div>
          <p className="mt-6 text-center text-dark-500 text-sm">
            <Link href="/login" className="text-brand-400 hover:underline">
              {tStr("pages.forgotPassword.login")}
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
            {tStr("pages.forgotPassword.backBrand")}
          </Link>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.forgotPassword.scanTitle")}</h1>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.forgotPassword.scanIntro")}
          </p>
          <div className="mt-6 flex justify-center">
            <OptimizedImage
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
              alt={tStr("pages.forgotPassword.qrAlt")}
              width={200}
              height={200}
              priority
              className="w-[200px] h-[200px] rounded-xl border border-dark-600"
            />
          </div>
          <p className="text-sm text-dark-400 mt-4 text-center break-all">
            {tStr("pages.forgotPassword.scanOpenPrefix")} {qrUrl}
          </p>
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-left text-xs text-amber-100/95 space-y-2">
            <p className="font-medium text-amber-200">
              {tStr("pages.forgotPassword.scanWarnTitle")}
            </p>
            <p>
              {tStr("pages.forgotPassword.scanWarnP1")}
            </p>
            <p className="text-dark-200">
              {tStr("pages.forgotPassword.scanWarnP2")}
            </p>
          </div>
          <p className="text-sm text-dark-300 mt-4 text-center">
            {tStr("pages.forgotPassword.scanWaiting")}
          </p>
          {error && (
            <p className="text-red-400 text-sm mt-2 text-center">{error}</p>
          )}
          <Link
            href="/forgot-password"
            className="mt-6 text-center text-dark-500 text-sm hover:text-zinc-900"
          >
            {tStr("pages.forgotPassword.scanBackOptions")}
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
            {tStr("pages.forgotPassword.backBrand")}
          </Link>
          <button
            type="button"
            onClick={() => { setMode("choose"); setError(""); setDevResetLink(null); }}
            className="text-dark-400 text-sm mt-2"
          >
            {tStr("pages.forgotPassword.emailBackOptions")}
          </button>
          <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.forgotPassword.emailTitle")}</h1>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.forgotPassword.emailIntro1")}
          </p>
          <p className="text-sm text-dark-300 mt-2">
            {tStr("pages.forgotPassword.emailIntro2")}
          </p>

          <form onSubmit={handleEmailSubmit} className="space-y-4 mt-6">
            <input
              type="email"
              placeholder={tStr("pages.forgotPassword.emailPlaceholder")}
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
              {loading ? tStr("pages.forgotPassword.emailSending") : tStr("pages.forgotPassword.emailSubmit")}
            </button>
          </form>

          <p className="mt-6 text-center text-dark-500 text-sm">
            {tStr("pages.forgotPassword.backToLoginLead")}{" "}
            <Link href="/login" className="text-brand-400 hover:underline">
              {tStr("pages.forgotPassword.login")}
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
          {tStr("pages.forgotPassword.backBrand")}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.forgotPassword.title")}</h1>
        <p className="text-sm text-dark-300 mt-2">
          {tStr("pages.forgotPassword.chooseIntro")}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setMode("email"); setDevResetLink(null); }}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl border border-dark-600 bg-dark-800 hover:bg-dark-700 text-zinc-900 font-medium text-sm transition flex items-center justify-center"
          >
            {tStr("pages.forgotPassword.btnEmail")}
          </button>
          <button
            type="button"
            onClick={startRecoveryScan}
            disabled={loading}
            className="w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl border border-brand-500/50 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-medium text-sm transition flex items-center justify-center disabled:opacity-50"
          >
            {loading ? tStr("pages.forgotPassword.btnScanPrep") : tStr("pages.forgotPassword.btnScan")}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-4">{error}</p>
        )}

        <p className="mt-6 text-center text-dark-500 text-sm">
          {tStr("pages.forgotPassword.backToLoginLead")}{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            {tStr("pages.forgotPassword.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
