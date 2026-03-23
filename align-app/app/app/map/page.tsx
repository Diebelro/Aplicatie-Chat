"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import MapView from "@/components/MapView";
import type { MapData } from "@/components/MapView";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  /** Fără cache vechi din browser — altfel poți apărea la sute de km de unde ești acum. */
  maximumAge: 0,
  timeout: 25_000,
};

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  const fetchMap = useCallback(() => {
    return fetch("/api/map", { headers: getAuthHeaders(), credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData({ me: d.me ?? null, users: d.users ?? [] });
      })
      .catch(() => setError("Eroare la încărcare"));
  }, []);

  const pushLocationThenRefresh = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(false);
    setGeoBusy(true);
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await fetch("/api/me", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              credentials: "same-origin",
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            });
            await fetchMap();
            resolve(true);
          } catch {
            resolve(false);
          } finally {
            setGeoBusy(false);
          }
        },
        () => {
          setGeoBusy(false);
          resolve(false);
        },
        GEO_OPTIONS
      );
    });
  }, [fetchMap]);

  /** La deschidere: întâi trimite GPS proaspăt, apoi încarcă harta (evită cursa vechi vs nou). */
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                await fetch("/api/me", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  credentials: "same-origin",
                  body: JSON.stringify({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  }),
                });
              } catch {
                /* ignore */
              }
              resolve();
            },
            () => resolve(),
            GEO_OPTIONS
          );
        });
      }
      if (!cancelled) {
        await fetchMap().finally(() => {
          if (!cancelled) setLoading(false);
        });
      }
      if (!cancelled) {
        interval = setInterval(() => {
          void fetchMap();
        }, 15000);
      }
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [fetchMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă harta...</span>
      </div>
    );
  }

  if (error || !data) {
    const storedEmail =
      typeof window !== "undefined"
        ? (() => {
            try {
              const raw = getStoredUserRaw();
              if (!raw) return "";
              const u = JSON.parse(raw) as User;
              return u?.email ? encodeURIComponent(u.email) : "";
            } catch {
              return "";
            }
          })()
        : "";
    const reconnectUrl = storedEmail ? `/signup?email=${storedEmail}` : "/signup";
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500 mb-4">{error ?? "Date indisponibile."}</p>
        <p className="text-sm text-dark-500 mb-2 max-w-md mx-auto">
          Ești deja în aplicație; serverul a repornit și nu te mai recunoaște. Nu trebuie să te loghezi „din nou” — apasă{" "}
          <strong>Reconectare</strong> și introdu același email și parolă ca la înregistrare (recreezi contul pe server).
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
      <p className="text-dark-500 text-sm mb-3">
        Markerii sunt <strong>medalioane cu poza de profil</strong>. Tu ai contur turcoaz. La alții:{" "}
        <strong className="text-green-500">contur verde = online</strong>, gri = offline (dacă ascund statusul, apare
        offline). <strong>Apasă pe un marker</strong> pentru a deschide profilul (mesaj, apel, etc.). Dacă distanța pare
        greșită: ultima poziție vine din <strong>browserul în care ești logat</strong> — apasă „Actualizează GPS” pe
        dispozitiv.
      </p>
      <div className="mb-4">
        <button
          type="button"
          disabled={geoBusy}
          onClick={() => void pushLocationThenRefresh()}
          className="px-4 py-2 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/40 hover:bg-brand-500/30 disabled:opacity-50 text-sm font-medium"
        >
          {geoBusy ? "Se actualizează…" : "Actualizează GPS (poziție proaspătă)"}
        </button>
      </div>
      <MapView data={data} />
      <p className="text-dark-500 text-xs mt-3">
        {data.me ? "Poziția ta este marcată pe hartă. " : "Activează locația în browser ca să apară poziția ta. "}
        {data.users.length} utilizator(i) cu locație vizibilă pe hartă.
      </p>
    </div>
  );
}
