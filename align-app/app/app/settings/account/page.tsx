"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { LegalDocLinks } from "@/components/LegalDocLinks";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

export default function AccountSettingsPage() {
  const { tStr } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [realName, setRealName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [personalSave, setPersonalSave] = useState(false);
  const [personalError, setPersonalError] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showDistance, setShowDistance] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [allowVisitVisibility, setAllowVisitVisibility] = useState(true);
  const [allowReadReceipts, setAllowReadReceipts] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [privacyLoading, setPrivacyLoading] = useState(true);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          const u = d.user as User;
          setUser(u);
          setRealName(u.real_name ?? "");
          setUsername(u.username ?? u.name ?? "");
          setEmail(u.email ?? "");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/me/subscription", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.planId) setSubscriptionPlan(d.planId);
        else if (d.premiumPermanent) setSubscriptionPlan("lifetime");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/me/settings", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setShowDistance(d.settings.show_distance !== false);
          setShowOnline(d.settings.show_online !== false);
          setAllowVisitVisibility(d.settings.allowVisitVisibility !== false);
          setAllowReadReceipts(d.settings.allowReadReceipts !== false);
          setAllowFriendRequests(d.settings.allowFriendRequests !== false);
        }
        setPrivacyLoading(false);
      })
      .catch(() => setPrivacyLoading(false));
  }, []);

  const checkUsername = (value: string) => {
    const v = value.trim().toLowerCase();
    if (v.length < 2) {
      setUsernameCheck("idle");
      return;
    }
    setUsernameCheck("checking");
    const uid = user?.id ?? "";
    fetch(`/api/check-username?value=${encodeURIComponent(v)}&excludeUserId=${encodeURIComponent(uid)}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.available) setUsernameCheck("available");
        else setUsernameCheck("taken");
      })
      .catch(() => setUsernameCheck("idle"));
  };

  const savePersonal = () => {
    setPersonalError("");
    setPersonalSave(true);
    fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        real_name: realName.trim() || null,
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        setPersonalSave(false);
        if (d.error) {
          const raw = String(d.error).trim();
          setPersonalError(raw ? translateApiErrorMessage(raw, tStr) || raw : "");
          return;
        }
        if (d.user) {
          setUser(d.user);
          if (typeof window !== "undefined") {
            const raw = getStoredUserRaw();
            if (raw) {
              try {
                const prev = JSON.parse(raw) as User;
                const next = { ...prev, ...d.user };
                localStorage.setItem("align_user", JSON.stringify(next));
                sessionStorage.setItem("align_user", JSON.stringify(next));
              } catch {}
            }
          }
        }
      })
      .catch(() => setPersonalSave(false));
  };

  const updatePassword = () => {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword.length < 8) {
      setPasswordError(tStr("pages.account.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(tStr("pages.account.passwordMismatch"));
      return;
    }
    fetch("/api/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ oldPassword, newPassword }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          const raw = String(d.error).trim();
          setPasswordError(raw ? translateApiErrorMessage(raw, tStr) || raw : "");
          return;
        }
        setPasswordSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      });
  };

  const updatePrivacy = (key: string, value: boolean) => {
    fetch("/api/me/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ [key]: value }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setShowDistance(d.settings.show_distance !== false);
          setShowOnline(d.settings.show_online !== false);
          setAllowVisitVisibility(d.settings.allowVisitVisibility !== false);
          setAllowReadReceipts(d.settings.allowReadReceipts !== false);
          setAllowFriendRequests(d.settings.allowFriendRequests !== false);
        }
      });
  };

  const deleteAccount = () => {
    if (!deletePassword.trim()) {
      setDeleteError(tStr("pages.account.deletePasswordRequired"));
      return;
    }
    setDeleting(true);
    setDeleteError("");
    fetch("/api/me/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ password: deletePassword }),
    })
      .then((r) => r.json())
      .then((d) => {
        setDeleting(false);
        if (d.error) {
          setDeleteError(d.error);
          return;
        }
        localStorage.removeItem("align_user");
        sessionStorage.removeItem("align_user");
        window.location.href = "/login";
      })
      .catch(() => setDeleting(false));
  };

  const inputClass = "w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-zinc-900 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500";
  const labelClass = "block text-dark-500 text-sm mb-1";

  const subscriptionPlanLabel =
    subscriptionPlan === "lifetime"
      ? tStr("pages.account.planLifetime")
      : subscriptionPlan === "monthly" || subscriptionPlan === "six_month" || subscriptionPlan === "yearly"
        ? tStr(`pages.subscriptionPlans.${subscriptionPlan}.name`)
        : subscriptionPlan ?? "";

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500">{tStr("pages.account.loading")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-10 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-4">
        <Link href="/app/profile" className="text-dark-400 hover:text-zinc-900 transition text-sm">
          {tStr("pages.account.backToProfile")}
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900">{tStr("pages.account.title")}</h1>
      </div>

      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600 border-brand-500/20">
        <h2 className="text-lg font-medium text-zinc-900 mb-2">{tStr("pages.account.feedbackTitle")}</h2>
        <p className="text-dark-500 text-sm mb-4">{tStr("pages.account.feedbackIntro")}</p>
        <Link
          href="/app/settings/feedback"
          className="inline-block px-4 py-2 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/40 hover:bg-brand-500/30 font-medium text-sm transition"
        >
          {tStr("pages.account.feedbackCta")}
        </Link>
      </section>

      {/* A) Personal info */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">{tStr("pages.account.personalTitle")}</h2>
        <p className="text-dark-500 text-sm mb-4">{tStr("pages.account.personalHint")}</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{tStr("pages.account.realNameLabel")}</label>
            <input
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder={tStr("pages.account.optionalPlaceholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{tStr("pages.account.usernameLabel")}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameCheck("idle");
              }}
              onBlur={() => checkUsername(username)}
              placeholder={tStr("pages.account.usernamePlaceholder")}
              className={inputClass}
            />
            {usernameCheck === "available" && (
              <p className="text-green-400 text-xs mt-1">{tStr("pages.account.usernameAvailable")}</p>
            )}
            {usernameCheck === "taken" && (
              <p className="text-amber-400 text-xs mt-1">{tStr("pages.account.usernameTaken")}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>{tStr("pages.account.emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <p className="text-dark-500 text-xs mt-1">{tStr("pages.account.emailChangeHint")}</p>
          </div>
          {personalError && <p className="text-red-400 text-sm">{personalError}</p>}
          <button
            type="button"
            onClick={savePersonal}
            disabled={personalSave}
            className="px-4 py-2 rounded-lg bg-brand-500 text-zinc-900 font-medium hover:bg-brand-600 disabled:opacity-50 transition"
          >
            {personalSave ? tStr("pages.account.saveSaving") : tStr("pages.account.save")}
          </button>
        </div>
      </section>

      {/* Abonament / Premium */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">{tStr("pages.account.subscriptionTitle")}</h2>
        <p className="text-dark-500 text-sm mb-3">
          {subscriptionPlan
            ? formatTpl(tStr("pages.account.subscriptionActive"), { plan: subscriptionPlanLabel })
            : tStr("pages.account.subscriptionNone")}
        </p>
        <Link
          href="/app/premium"
          className="inline-block px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30 font-medium text-sm transition"
        >
          {tStr("pages.account.managePremium")}
        </Link>
      </section>

      {/* B) Password */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">{tStr("pages.account.passwordTitle")}</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{tStr("pages.account.currentPassword")}</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelClass}>{tStr("pages.account.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelClass}>{tStr("pages.account.confirmNewPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
          {passwordSuccess && <p className="text-green-400 text-sm">{tStr("pages.account.passwordUpdated")}</p>}
          <button
            type="button"
            onClick={updatePassword}
            className="px-4 py-2 rounded-lg bg-brand-500 text-zinc-900 font-medium hover:bg-brand-600 transition"
          >
            {tStr("pages.account.updatePasswordBtn")}
          </button>
        </div>
      </section>

      {/* C) Privacy */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">{tStr("pages.account.privacyTitle")}</h2>
        {privacyLoading ? (
          <p className="text-dark-500 text-sm">{tStr("pages.account.privacyLoading")}</p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showDistance}
                onChange={(e) => updatePrivacy("show_distance", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">{tStr("pages.account.privacyShowDistance")}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnline}
                onChange={(e) => updatePrivacy("show_online", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">{tStr("pages.account.privacyShowOnline")}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowVisitVisibility}
                onChange={(e) => updatePrivacy("allowVisitVisibility", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">{tStr("pages.account.privacyVisitVisibility")}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowReadReceipts}
                onChange={(e) => updatePrivacy("allowReadReceipts", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">{tStr("pages.account.privacyReadReceipts")}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowFriendRequests}
                onChange={(e) => updatePrivacy("allowFriendRequests", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">{tStr("pages.account.privacyFriendRequests")}</span>
            </label>
          </div>
        )}
      </section>

      {/* D) GDPR */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">{tStr("pages.account.gdprTitle")}</h2>
        <div className="space-y-4">
          <div>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-dark-700 text-dark-300 border border-dark-600 hover:bg-dark-600 transition text-sm"
            >
              {tStr("pages.account.exportData")}
            </button>
            <p className="text-dark-500 text-xs mt-1">{tStr("pages.account.exportHint")}</p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition text-sm"
            >
              {tStr("pages.account.deleteAccount")}
            </button>
            <p className="text-dark-500 text-xs mt-1">{tStr("pages.account.deleteAccountHint")}</p>
          </div>
        </div>
      </section>

      <section className="mt-10 pt-6 border-t border-dark-600">
        <h3 className="text-sm font-medium text-dark-400 mb-3">{tStr("pages.account.legalDocs")}</h3>
        <LegalDocLinks privacyLinkLabel="Privacy Policy" />
      </section>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-zinc-900 mb-2">{tStr("pages.account.deleteModalTitle")}</h3>
            <p className="text-dark-400 text-sm mb-4">{tStr("pages.account.deleteModalBody")}</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={tStr("pages.account.deletePasswordPlaceholder")}
              className={inputClass + " mb-4"}
              autoComplete="current-password"
            />
            {deleteError && <p className="text-red-400 text-sm mb-2">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-dark-600 text-zinc-900 hover:bg-dark-500 transition"
              >
                {tStr("pages.account.cancel")}
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
              >
                {deleting ? tStr("pages.account.deleteInProgress") : tStr("pages.account.deleteConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
