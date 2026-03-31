"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MapView from "@/components/MapView";
import type { MapData } from "@/components/MapView";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry } from "@/lib/authClient";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 25_000,
};

const INITIAL_GEO_CAP_MS = 5000;

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  /** După montare — același ID pe server și client la primul paint (evită hydration mismatch). */
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = getStoredUserRaw();
      if (!raw) return;
      const u = JSON.parse(raw) as User;
      if (u?.id != null) setViewerUserId(String(u.id).trim());
    } catch {
      /* ignore */
    }
  }, []);

  const fetchMap = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    return fetchWithAuthRetry("/api/map", { cache: "no-store" })
      .then(async (r) => {
        type MapJson = { error?: string; me?: MapData["me"]; users?: MapData["users"] };
        let d: MapJson = {};
        try {
          d = (await r.json()) as MapJson;
        } catch {
          if (!silent) setError("Răspuns invalid de la server.");
          return;
        }
        if (!r.ok) {
          if (!silent) {
            if (r.status === 401) {
              setError("Nu ești autentificat pentru hartă. Intră în cont și încearcă din nou.");
            } else {
              setError(d.error?.trim() || "Nu am putut încărca harta.");
            }
          }
          return;
        }
        if (d.error) {
          if (!silent) setError(d.error);
          return;
        }
        setError(null);
        setData({
          me: d.me ?? null,
          users: Array.isArray(d.users) ? d.users : [],
        });
      })
      .catch(() => {
        if (!silent) setError("Eroare la încărcare (rețea sau server oprit).");
      });
  }, []);

  const pushLocationThenRefresh = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(false);
    setGeoBusy(true);
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await fetchWithAuthRetry("/api/me", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        await Promise.race([
          new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  await fetchWithAuthRetry("/api/me", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
          }),
          new Promise<void>((resolve) => setTimeout(resolve, INITIAL_GEO_CAP_MS)),
        ]);
      }
      if (!cancelled) {
        await fetchMap().finally(() => {
          if (!cancelled) setLoading(false);
        });
      }
      if (!cancelled) {
        interval = setInterval(() => {
          void fetchMap({ silent: true });
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
        <span className="text-dark-500">Se încarcă harta…</span>
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
    const isAuth = error?.includes("autentificat");
    return (
      <div className="py-12 text-center px-3">
        <p className="text-dark-700 mb-3 font-medium">{error ?? "Date indisponibile."}</p>
        {isAuth ? (
          <Link href="/login?redirect=%2Fapp%2Fmap" className="inline-block text-brand-600 hover:underline font-medium">
            Intră în cont
          </Link>
        ) : (
          <>
            <p className="text-sm text-dark-500 mb-2 max-w-md mx-auto">
              Dacă tocmai ai dat din nou drumul la server local sau ți-a expirat sesiunea: ieși din cont și intră din nou,
              sau folosește reconectarea de mai jos.
            </p>
            <Link
              href={reconnectUrl}
              className="inline-block mt-2 px-4 py-2 rounded-lg bg-brand-500/20 text-brand-600 hover:bg-brand-500/30 transition"
            >
              Reconectare (același email și parolă)
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Harta</h2>
      <p className="text-dark-500 text-sm mb-3">
        Markerii sunt <strong>medalioane cu poza de profil</strong>. Tu ai contur turcoaz. La alții:{" "}
        <strong className="text-green-600">contur verde = online</strong>, gri = offline.{" "}
        <strong>Apasă pe un marker</strong> pentru profil.
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
      <MapView data={data} viewerUserId={viewerUserId} />
      <p className="text-dark-500 text-xs mt-3">
        {data.me ? "Poziția ta este marcată pe hartă. " : "Activează locația în browser ca să apară poziția ta. "}
        {data.users.length} utilizator(i) cu locație vizibilă pe hartă.
      </p>
    </div>
  );
}
