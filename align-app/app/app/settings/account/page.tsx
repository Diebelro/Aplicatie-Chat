"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { LegalDocLinks } from "@/components/LegalDocLinks";

export default function AccountSettingsPage() {
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
          setPersonalError(d.error);
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
      setPasswordError("Parola nouă trebuie să aibă cel puțin 8 caractere.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Parola nouă și confirmarea nu coincid.");
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
          setPasswordError(d.error);
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
      setDeleteError("Introdu parola pentru a confirma.");
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

  const inputClass = "w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500";
  const labelClass = "block text-dark-500 text-sm mb-1";

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500">Se încarcă...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-10">
      <div className="flex items-center gap-4">
        <Link href="/app/profile" className="text-dark-400 hover:text-white transition text-sm">
          ← Înapoi la profil
        </Link>
        <h1 className="text-xl font-semibold text-white">Setări cont</h1>
      </div>

      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600 border-brand-500/20">
        <h2 className="text-lg font-medium text-white mb-2">Propuneri și feedback</h2>
        <p className="text-dark-500 text-sm mb-4">
          Ai o idee ca să îmbunătățim aplicația sau ai întâlnit ceva care nu merge? Scrie-ne — citim tot și ne ajută să
          reparăm rapid.
        </p>
        <Link
          href="/app/settings/feedback"
          className="inline-block px-4 py-2 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/40 hover:bg-brand-500/30 font-medium text-sm transition"
        >
          Trimite un mesaj
        </Link>
      </section>

      {/* A) Personal info */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-white mb-4">Informații personale</h2>
        <p className="text-dark-500 text-sm mb-4">Numele real este privat și se afișează doar aici. În aplicație alții te văd username-ul tău.</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Nume real (privat)</label>
            <input
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="Opțional"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Username (public)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameCheck("idle");
              }}
              onBlur={() => checkUsername(username)}
              placeholder="ex. maria_popescu"
              className={inputClass}
            />
            {usernameCheck === "available" && <p className="text-green-400 text-xs mt-1">Disponibil</p>}
            {usernameCheck === "taken" && <p className="text-amber-400 text-xs mt-1">Deja folosit</p>}
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <p className="text-dark-500 text-xs mt-1">Schimbarea emailului poate necesita verificare (în dezvoltare).</p>
          </div>
          {personalError && <p className="text-red-400 text-sm">{personalError}</p>}
          <button
            type="button"
            onClick={savePersonal}
            disabled={personalSave}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-50 transition"
          >
            {personalSave ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </section>

      {/* Abonament / Premium */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-white mb-4">Abonament Premium</h2>
        <p className="text-dark-500 text-sm mb-3">
          {subscriptionPlan
            ? `Plan activ: ${
                subscriptionPlan === "lifetime"
                  ? "Premium permanent"
                  : subscriptionPlan === "yearly"
                    ? "Premium anual"
                    : subscriptionPlan === "six_month"
                      ? "Premium 6 luni"
                      : "Premium lunar"
              }.`
            : "Nu ai abonament activ. Poti activa Premium rewarded (1h) sau abonament lunar / 6 luni / anual."}
        </p>
        <Link
          href="/app/premium"
          className="inline-block px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30 font-medium text-sm transition"
        >
          Gestioneaza Premium
        </Link>
      </section>

      {/* B) Password */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-white mb-4">Parolă</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Parola curentă</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelClass}>Parolă nouă</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelClass}>Confirmă parola nouă</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
          {passwordSuccess && <p className="text-green-400 text-sm">Parola a fost actualizată.</p>}
          <button
            type="button"
            onClick={updatePassword}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition"
          >
            Actualizează parola
          </button>
        </div>
      </section>

      {/* C) Privacy */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-white mb-4">Confidențialitate</h2>
        {privacyLoading ? (
          <p className="text-dark-500 text-sm">Se încarcă...</p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showDistance}
                onChange={(e) => updatePrivacy("show_distance", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">Afișează distanța mea altor utilizatori</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnline}
                onChange={(e) => updatePrivacy("show_online", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">Afișează că sunt online</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowVisitVisibility}
                onChange={(e) => updatePrivacy("allowVisitVisibility", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">Alții pot vedea când le vizitez profilul</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowReadReceipts}
                onChange={(e) => updatePrivacy("allowReadReceipts", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">Arată „citit” la mesaje (read receipts)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowFriendRequests}
                onChange={(e) => updatePrivacy("allowFriendRequests", e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-300">Permite cereri de prietenie</span>
            </label>
          </div>
        )}
      </section>

      {/* D) GDPR */}
      <section className="p-6 rounded-2xl bg-dark-800 border border-dark-600">
        <h2 className="text-lg font-medium text-white mb-4">Date personale (GDPR)</h2>
        <div className="space-y-4">
          <div>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-dark-700 text-dark-300 border border-dark-600 hover:bg-dark-600 transition text-sm"
            >
              Descarcă datele mele (în dezvoltare)
            </button>
            <p className="text-dark-500 text-xs mt-1">Vei primi un arhivă cu datele tale.</p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition text-sm"
            >
              Șterge contul
            </button>
            <p className="text-dark-500 text-xs mt-1">Ștergerea este permanentă. Va fi cerută parola.</p>
          </div>
        </div>
      </section>

      <section className="mt-10 pt-6 border-t border-dark-600">
        <h3 className="text-sm font-medium text-dark-400 mb-3">Documente legale</h3>
        <LegalDocLinks />
      </section>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-2">Ștergere cont</h3>
            <p className="text-dark-400 text-sm mb-4">Această acțiune este permanentă. Toate datele tale vor fi șterse. Introdu parola pentru a confirma.</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Parola ta"
              className={inputClass + " mb-4"}
              autoComplete="current-password"
            />
            {deleteError && <p className="text-red-400 text-sm mb-2">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDeleteConfirmOpen(false); setDeletePassword(""); setDeleteError(""); }}
                className="flex-1 px-4 py-2 rounded-lg bg-dark-600 text-white hover:bg-dark-500 transition"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
              >
                {deleting ? "Se șterge..." : "Șterge contul"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
