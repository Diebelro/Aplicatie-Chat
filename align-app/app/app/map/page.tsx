"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MapView from "@/components/MapView";
import type { MapData } from "@/components/MapView";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-trimite locația când deschizi harta, ca poziția ta să fie actualizată
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch("/api/me", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    const fetchMap = () => {
      fetch("/api/map", { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) setError(d.error);
          else setData({ me: d.me ?? null, users: d.users ?? [] });
        })
        .catch(() => setError("Eroare la încărcare"))
        .finally(() => setLoading(false));
    };
    fetchMap();
    const t = setInterval(fetchMap, 15000); // reîmprospătare la 15s
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă harta...</span>
      </div>
    );
  }

  if (error || !data) {
    const storedEmail = typeof window !== "undefined" ? (() => {
      try {
        const raw = getStoredUserRaw();
        if (!raw) return "";
        const u = JSON.parse(raw) as User;
        return u?.email ? encodeURIComponent(u.email) : "";
      } catch { return ""; }
    })() : "";
    const reconnectUrl = storedEmail ? `/signup?email=${storedEmail}` : "/signup";
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500 mb-4">{error ?? "Date indisponibile."}</p>
        <p className="text-sm text-dark-500 mb-2 max-w-md mx-auto">
          Ești deja în aplicație; serverul a repornit și nu te mai recunoaște. Nu trebuie să te loghezi „din nou” — apasă <strong>Reconectare</strong> și introdu același email și parolă ca la înregistrare (recreezi contul pe server).
        </p>
        <Link
          href={reconnectUrl}
          className="inline-block mt-2 px-4 py-2 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition"
        >
          Reconectare (același email și parolă)
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Harta</h2>
      <p className="text-dark-500 text-sm mb-4">
        Vezi cine e online lângă tine. Poziția ta și a celorlalți apare doar dacă ați acceptat locația în browser. Reîmprospătează pagina pentru a actualiza.
      </p>
      <MapView data={data} />
      <p className="text-dark-500 text-xs mt-3">
        {data.me ? "Poziția ta este marcată pe hartă. " : "Activează locația în browser ca să apară poziția ta. "}
        {data.users.length} utilizator(i) online cu locație vizibilă.
      </p>
    </div>
  );
}
