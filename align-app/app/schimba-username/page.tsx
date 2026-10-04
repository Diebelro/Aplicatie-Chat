"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/store";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import { PublicAuthPageLayout } from "@/components/PublicAuthPageLayout";
import { DiebelWordmark } from "@/components/DiebelWordmark";

export default function SchimbaUsernamePage() {
  const { tStr } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [showBio, setShowBio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetchWithAuthRetry("/api/me", { cache: "no-store" });
      if (cancelled) return;
      if (!r.ok) {
        router.replace("/login?redirect=/schimba-username");
        return;
      }
      const d = (await r.json().catch(() => ({}))) as { user?: User };
      if (!d.user) {
        router.replace("/login?redirect=/schimba-username");
        return;
      }
      if (d.user.isBanned) {
        router.replace("/cont-blocat");
        return;
      }
      if (!d.user.mustChangeUsername) {
        router.replace("/app");
        return;
      }
      setUser(d.user);
      setUsername("");
      setBio(d.user.bio ?? "");
      setShowBio(!!(d.user.bio && d.user.bio.trim()));
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const checkUsername = (value: string) => {
    const v = value.trim().toLowerCase();
    if (v.length < 2 || !user?.id) {
      setCheck("idle");
      return;
    }
    setCheck("checking");
    void (async () => {
      try {
        const r = await fetchWithAuthRetry(
          `/api/check-username?value=${encodeURIComponent(v)}&excludeUserId=${encodeURIComponent(user.id)}`,
          { cache: "no-store" }
        );
        const d = (await r.json().catch(() => ({}))) as { available?: boolean };
        if (!r.ok) {
          setCheck("idle");
          return;
        }
        setCheck(d.available ? "available" : "taken");
      } catch {
        setCheck("idle");
      }
    })();
  };

  const save = () => {
    if (!user || busy) return;
    const next = username.trim().toLowerCase();
    if (next === String(user.username ?? "").trim().toLowerCase()) {
      setError(tStr("pages.changeUsername.errSame"));
      return;
    }
    setBusy(true);
    setError("");
    void (async () => {
      try {
        const body: { username: string; bio?: string } = { username: next };
        if (showBio) body.bio = bio;
        const r = await fetchWithAuthRetry("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = (await r.json().catch(() => ({}))) as { error?: string; user?: User };
        if (!r.ok || d.error) {
          const raw = typeof d.error === "string" ? d.error.trim() : "";
          setError(raw ? translateApiErrorMessage(raw, tStr) || raw : tStr("pages.changeUsername.errSave"));
          return;
        }
        if (d.user) {
          try {
            const raw = localStorage.getItem("align_user") ? localStorage : sessionStorage;
            raw.setItem("align_user", JSON.stringify(d.user));
          } catch {
            /* ignore */
          }
        }
        window.location.href = "/app";
      } catch {
        setError(tStr("pages.changeUsername.errSave"));
      } finally {
        setBusy(false);
      }
    })();
  };

  const field =
    "w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <PublicAuthPageLayout backHref="/" backLabel={tStr("pages.changeUsername.backBrand")}>
      <div className="w-full max-w-[min(100%,24rem)] mx-auto py-8 space-y-5">
        <DiebelWordmark variant="kicker" withMark className="block text-center" />
        <h1 className="ui-page-title text-2xl text-center">{tStr("pages.changeUsername.title")}</h1>
        <p className="text-sm text-dark-500 leading-relaxed text-center">{tStr("pages.changeUsername.intro")}</p>
        {user ? (
          <p className="text-xs text-dark-400 text-center">
            {tStr("pages.changeUsername.currentLabel")}: <span className="font-medium text-zinc-800">{user.username}</span>
          </p>
        ) : null}
        <div>
          <label className="ui-form-label block text-sm mb-1" htmlFor="new-username">
            {tStr("pages.changeUsername.newLabel")}
          </label>
          <input
            id="new-username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value.replace(/[^a-zA-Z]/g, ""));
              setCheck("idle");
            }}
            onBlur={() => checkUsername(username)}
            placeholder={tStr("pages.changeUsername.placeholder")}
            className={field}
          />
          {check === "available" ? (
            <p className="text-green-600 text-xs mt-1">{tStr("pages.changeUsername.available")}</p>
          ) : null}
          {check === "taken" ? (
            <p className="text-amber-700 text-xs mt-1">{tStr("pages.changeUsername.taken")}</p>
          ) : null}
        </div>
        {showBio ? (
          <div>
            <label className="ui-form-label block text-sm mb-1" htmlFor="new-bio">
              {tStr("pages.changeUsername.bioLabel")}
            </label>
            <textarea
              id="new-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className={field}
            />
            <p className="text-xs text-dark-500 mt-1">{tStr("pages.changeUsername.bioHint")}</p>
          </div>
        ) : null}
        {error ? (
          <p className="text-red-500 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={busy || username.trim().length < 2}
          className="w-full min-h-11 rounded-xl bg-brand-500 text-zinc-900 font-semibold hover:bg-brand-600 disabled:opacity-50 touch-manipulation"
        >
          {busy ? tStr("pages.changeUsername.saving") : tStr("pages.changeUsername.save")}
        </button>
      </div>
    </PublicAuthPageLayout>
  );
}
