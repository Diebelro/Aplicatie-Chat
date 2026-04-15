"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useI18n } from "@/lib/i18n/context";

/** Esențiale: Google, Apple, Email, Telefon. Recomandate: Microsoft, Facebook, Yahoo. */
const PROVIDERS = [
  { id: "google", label: "Continue with Google", essential: true, nextAuthId: "google" as const },
  { id: "apple", label: "Continue with Apple", essential: true, nextAuthId: "apple" as const },
  { id: "phone", label: "Continue with Phone Number (SMS)", essential: true },
  { id: "microsoft", label: "Continue with Microsoft", essential: false, nextAuthId: "azure-ad" as const },
  { id: "facebook", label: "Continue with Facebook", essential: false, nextAuthId: "facebook" as const },
  { id: "yahoo", label: "Continue with Yahoo Mail", essential: false },
] as const;

type SocialCfg = {
  google: boolean;
  facebook: boolean;
  apple: boolean;
  microsoft: boolean;
};

/** Map id SocialConfig key */
function cfgKey(providerId: string): keyof SocialCfg | null {
  if (providerId === "google") return "google";
  if (providerId === "facebook") return "facebook";
  if (providerId === "apple") return "apple";
  if (providerId === "microsoft") return "microsoft";
  return null;
}

const LOGIN_HERO_IDS = ["google", "phone"] as const;

interface AuthProvidersProps {
  /** Pagina Creează cont: butoane compacte (44px, icon 20px, gap-2). Fără wrapper cu py/min-h/h-full. */
  compact?: boolean;
  /** Login: doar Google + telefon, ordine și stiluri primary/secondary. */
  variant?: "default" | "loginHero";
}

const compactButtonClass = `
  w-full
  flex items-center justify-center
  gap-2
  px-4
  rounded-xl
  border border-dark-600
  bg-dark-800
  text-zinc-900
  hover:bg-dark-700
  transition
  font-medium
  text-sm
  !h-11
  !min-h-[44px]
  !max-h-[44px]
  !py-0
`.replace(/\s+/g, " ").trim();

export default function AuthProviders({ compact, variant = "default" }: AuthProvidersProps) {
  const router = useRouter();
  const { tStr } = useI18n();
  const [socialCfg, setSocialCfg] = useState<SocialCfg | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/social-config")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: Partial<SocialCfg>) => {
        if (!cancelled) {
          setSocialCfg({
            google: !!j.google,
            facebook: !!j.facebook,
            apple: !!j.apple,
            microsoft: !!j.microsoft,
          });
        }
      })
      .catch(() => {
        if (!cancelled)
          setSocialCfg({ google: false, facebook: false, apple: false, microsoft: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClick = (p: (typeof PROVIDERS)[number]) => {
    if (p.id === "phone" || p.id === "yahoo") {
      router.push(`/login?soon=1&auth=${encodeURIComponent(p.id)}`);
      return;
    }
    if (!("nextAuthId" in p)) return;
    const key = cfgKey(p.id);
    if (key && socialCfg && !socialCfg[key]) {
      router.push(`/login?reason=oauth_not_configured&p=${encodeURIComponent(p.id)}`);
      return;
    }
    const cb = `${window.location.origin}/api/auth/align-bridge`;
    void signIn(p.nextAuthId, { callbackUrl: cb });
  };

  if (process.env.NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN === "false") {
    return null;
  }

  const cfgReady = socialCfg !== null;

  const list =
    variant === "loginHero"
      ? LOGIN_HERO_IDS.map((id) => PROVIDERS.find((p) => p.id === id)).filter(
          (p): p is (typeof PROVIDERS)[number] => p != null
        )
      : [...PROVIDERS];

  const heroLabel = (p: (typeof PROVIDERS)[number]) => {
    if (variant !== "loginHero") return p.label;
    if (p.id === "google") return tStr("pages.login.btnGoogle");
    if (p.id === "phone") return tStr("pages.login.btnPhone");
    return p.label;
  };

  const heroButtonClass = (p: (typeof PROVIDERS)[number], disabled: boolean) => {
    const base =
      "w-full min-h-[48px] shrink-0 flex items-center justify-center gap-2.5 rounded-xl px-4 text-sm font-semibold transition touch-manipulation active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100";
    if (variant !== "loginHero") {
      return (
        (compact ? compactButtonClass : "w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-dark-600 bg-dark-800 text-zinc-900 hover:bg-dark-700 transition font-medium text-sm") +
        (disabled ? " opacity-45 cursor-not-allowed" : "")
      );
    }
    if (p.id === "google") {
      return `${base} border border-neutral-200/90 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50 hover:border-neutral-300`;
    }
    return `${base} border border-dark-500 bg-dark-800 text-zinc-100 hover:bg-dark-700 hover:border-dark-400`;
  };

  return (
      <div className={variant === "loginHero" ? "flex w-full flex-col gap-3" : compact ? "flex flex-col gap-2" : "space-y-2"}>
        {list.map((p) => {
          const key = cfgKey(p.id);
          const oauthConfigured = key == null ? true : !cfgReady || socialCfg![key];
          const disabled = !oauthConfigured;
          const title = disabled
            ? `Nu e configurat pe server (vezi .env.example — ${p.id})`
            : undefined;

          return (
            <button
              key={p.id}
              type="button"
              title={title}
              disabled={disabled}
              onClick={() => handleClick(p)}
              className={heroButtonClass(p, disabled)}
            >
              <ProviderIcon id={p.id} compact={variant === "loginHero" || compact} />
              <span>{heroLabel(p)}</span>
            </button>
          );
        })}
      </div>
  );
}

const COMPACT_ICON_SIZE = "w-5 h-5 shrink-0";

function ProviderIcon({ id, compact }: { id: string; compact?: boolean }) {
  const c = compact ? COMPACT_ICON_SIZE : "w-5 h-5 shrink-0";
  switch (id) {
    case "google":
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      );
    case "apple":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      );
    case "microsoft":
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden>
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="#1877F2" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "phone":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    case "yahoo":
      return (
        <svg className={c} viewBox="0 0 24 24" aria-hidden>
          <path fill="#6001D2" d="M12.917 13.055l2.662-4.838 2.657 4.838h2.155l-3.484-6.004 3.228-5.495h-2.1l-2.456 4.409-2.457-4.41h-2.15l3.23 5.496-3.485 6.003h2.101z" />
        </svg>
      );
    default:
      return null;
  }
}
