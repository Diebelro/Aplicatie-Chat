"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { useI18n } from "@/lib/i18n/context";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";

export default function OnboardingLocationPage() {
  const { tStr } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allowLocation = () => {
    setLoading(true);
    setError("");
    if (!navigator.geolocation) {
      setError(tStr("pages.onboardingLocation.errNoGeo"));
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch("/api/me/location", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            location_enabled: true,
          }),
        })
          .then((r) =>
            r.ok
              ? router.push("/app")
              : r.json().then((d) => {
                  const raw = String(d.error ?? "").trim();
                  setError(raw ? translateApiErrorMessage(raw, tStr) || raw : tStr("pages.onboardingLocation.errSave"));
                })
          )
          .catch(() => setError(tStr("pages.onboardingLocation.errSave")))
          .finally(() => setLoading(false));
      },
      () => {
        setError(tStr("pages.onboardingLocation.errPermission"));
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const skipLocation = () => {
    setLoading(true);
    setError("");
    fetch("/api/me/location", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ location_enabled: false }),
    })
      .then((r) =>
        r.ok
          ? router.push("/app")
          : r.json().then((d) => {
              const raw = String(d.error ?? "").trim();
              setError(raw ? translateApiErrorMessage(raw, tStr) || raw : tStr("pages.onboardingLocation.errGeneric"));
            })
      )
      .catch(() => setError(tStr("pages.onboardingLocation.errGeneric")))
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-2">{tStr("pages.onboardingLocation.title")}</h1>
        <p className="text-dark-400 text-sm mb-8">{tStr("pages.onboardingLocation.body")}</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={allowLocation}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium transition disabled:opacity-50"
          >
            {loading ? tStr("pages.onboardingLocation.btnLoading") : tStr("pages.onboardingLocation.btnAllow")}
          </button>
          <button
            type="button"
            onClick={skipLocation}
            disabled={loading}
            className="w-full py-3 rounded-xl border border-dark-600 text-gray-300 hover:bg-dark-800 font-medium transition disabled:opacity-50"
          >
            {tStr("pages.onboardingLocation.skip")}
          </button>
        </div>
        <p className="mt-6 text-dark-500 text-xs">
          <Link href="/app" className="text-brand-400 hover:underline">
            {tStr("pages.onboardingLocation.goApp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
