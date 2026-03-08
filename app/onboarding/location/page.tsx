"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredUserRaw } from "@/lib/store";
import type { User } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";

export default function OnboardingLocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allowLocation = () => {
    setLoading(true);
    setError("");
    if (!navigator.geolocation) {
      setError("Browser-ul tău nu suportă geolocația.");
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
          .then((r) => (r.ok ? router.push("/app") : r.json().then((d) => { setError(d.error || "Eroare"); })))
          .catch(() => setError("Eroare la salvare"))
          .finally(() => setLoading(false));
      },
      () => {
        setError("Nu am putut obține locația. Verifică permisiunile browserului.");
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
      .then((r) => (r.ok ? router.push("/app") : r.json().then((d) => { setError(d.error || "Eroare"); })))
      .catch(() => setError("Eroare"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">Permite locația</h1>
        <p className="text-dark-400 text-sm mb-8">
          Folosim locația doar pentru a arăta distanța dintre utilizatori.
        </p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={allowLocation}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium transition disabled:opacity-50"
          >
            {loading ? "Se încarcă..." : "Permite locația"}
          </button>
          <button
            type="button"
            onClick={skipLocation}
            disabled={loading}
            className="w-full py-3 rounded-xl border border-dark-600 text-gray-300 hover:bg-dark-800 font-medium transition disabled:opacity-50"
          >
            Nu acum
          </button>
        </div>
        <p className="mt-6 text-dark-500 text-xs">
          <Link href="/app" className="text-brand-400 hover:underline">
            Mergi direct la aplicație
          </Link>
        </p>
      </div>
    </div>
  );
}
