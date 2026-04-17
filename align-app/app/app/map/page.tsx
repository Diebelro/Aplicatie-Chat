"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MapView from "@/components/MapView";
import type { MapData } from "@/components/MapView";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry, getAuthHeaders } from "@/lib/authClient";
import {
  MAP_LIVE_LOCATION_INTERVAL_MS,
  MAP_VISIBILITY_MAX_MINUTES,
  MAP_VISIBILITY_MIN_MINUTES,
} from "@/lib/mapVisibilityConstants";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { AppProLoading } from "@/components/AppProLoading";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 60_000,
  timeout: 25_000,
};

const GEO_LIVE_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 45_000,
  timeout: 25_000,
};

export default function MapPage() {
  const { tStr } = useI18n();
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [durationMin, setDurationMin] = useState(60);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

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

  const fetchMap = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    return fetchWithAuthRetry("/api/map", { cache: "no-store" })
      .then(async (r) => {
        type MapJson = {
          error?: string;
          me?: MapData["me"];
          users?: MapData["users"];
          sessionExpired?: boolean;
        };
        let d: MapJson = {};
        try {
          d = (await r.json()) as MapJson;
        } catch {
          if (!silent) setError(tStr("pages.map.errInvalidResponse"));
          return;
        }
        if (!r.ok) {
          if (!silent) {
            if (r.status === 401) {
              setError(tStr("pages.map.errNotAuth"));
            } else {
              setError(d.error?.trim() || tStr("pages.map.errLoadMap"));
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
        if (!silent) setError(tStr("pages.map.errNetwork"));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [tStr]);

  useEffect(() => {
    void fetchMap();
  }, [fetchMap]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const postCoordsToServer = useCallback(
    async (
      latitude: number,
      longitude: number,
      syncStore: boolean
    ): Promise<boolean> => {
      const r = await fetch("/api/me/location", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          latitude,
          longitude,
          location_enabled: true,
        }),
      });
      try {
        await r.json();
      } catch {
        /* ignore */
      }
      if (!r.ok) {
        return false;
      }
      if (syncStore) {
        const raw = getStoredUserRaw();
        if (raw) {
          try {
            const u = JSON.parse(raw) as User;
            const next = {
              ...u,
              location_enabled: true,
              latitude,
              longitude,
            };
            if (typeof localStorage !== "undefined") localStorage.setItem("align_user", JSON.stringify(next));
            if (typeof sessionStorage !== "undefined") sessionStorage.setItem("align_user", JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
      }
      return true;
    },
    []
  );

  /** Cât timp ești vizibil pe hartă: retrimiteri periodice GPS → același punct ca pentru ceilalți (și stând pe loc). */
  useEffect(() => {
    const untilIso = data?.me?.mapVisibleUntil ?? null;
    if (!untilIso) return;
    const untilMs = new Date(untilIso).getTime();
    if (!Number.isFinite(untilMs) || untilMs <= Date.now()) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;

    const run = () => {
      if (cancelled || Date.now() > untilMs) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled || Date.now() > untilMs) return;
          void (async () => {
            const ok = await postCoordsToServer(pos.coords.latitude, pos.coords.longitude, true);
            if (ok && !cancelled) void fetchMap({ silent: true });
          })();
        },
        () => {},
        GEO_LIVE_OPTIONS
      );
    };

    run();
    const intervalId = window.setInterval(run, MAP_LIVE_LOCATION_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [data?.me?.mapVisibleUntil, fetchMap, postCoordsToServer]);

  const saveLocationThen = (after: () => void) => {
    if (!navigator.geolocation) {
      setError(tStr("pages.map.errBrowserGeo"));
      return;
    }
    setGeoBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const ok = await postCoordsToServer(pos.coords.latitude, pos.coords.longitude, true);
          if (!ok) {
            setError(tStr("pages.map.errSaveLocation"));
          } else {
            after();
          }
          setGeoBusy(false);
        })();
      },
      () => {
        setGeoBusy(false);
        setError(tStr("pages.map.errReadGeo"));
      },
      GEO_OPTIONS
    );
  };

  const startVisibility = () => {
    const ok = window.confirm(formatTpl(tStr("pages.map.confirmStart"), { n: durationMin }));
    if (!ok) return;

    const run = () => {
      fetch("/api/me/map-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ durationMinutes: durationMin }),
      })
        .then((r) => r.json().then((j) => ({ r, j })))
        .then(({ r, j }) => {
          if (!r.ok) {
            setError(typeof j.error === "string" ? j.error : tStr("pages.map.errActivateVisibility"));
            return;
          }
          void fetchMap({ silent: true });
        });
    };

    if (!data?.me) {
      saveLocationThen(run);
      return;
    }
    run();
  };

  const stopVisibility = () => {
    fetch("/api/me/map-visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ off: true }),
    })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (!r.ok) {
          setError(typeof j.error === "string" ? j.error : tStr("pages.map.errGeneric"));
          return;
        }
        void fetchMap({ silent: true });
      });
  };

  const remainingLabel = useCallback(
    (untilIso: string | null): string | null => {
      if (!untilIso) return null;
      const end = new Date(untilIso).getTime();
      if (end <= nowTick) return tStr("pages.map.expired");
      const sec = Math.floor((end - nowTick) / 1000);
      const m = Math.floor(sec / 60);
      const h = Math.floor(m / 60);
      const mm = m % 60;
      if (h > 0) return formatTpl(tStr("pages.map.remainingHours"), { h, mm });
      return formatTpl(tStr("pages.map.remainingMin"), { n: m });
    },
    [nowTick, tStr]
  );

  const mapIntro = useMemo(
    () =>
      formatTpl(tStr("pages.map.intro"), {
        min: MAP_VISIBILITY_MIN_MINUTES,
        max: MAP_VISIBILITY_MAX_MINUTES,
      }),
    [tStr]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="app-pro-page-title">{tStr("pages.map.title")}</h1>
        <Link href="/app/profiles" className="text-sm text-brand-600 hover:underline">
          {tStr("pages.map.backProfiles")}
        </Link>
      </div>

      <p className="app-pro-lead mb-4">{mapIntro}</p>
      <p className="text-sm text-amber-600/90 border border-amber-700/40 bg-amber-950/20 rounded-xl px-3 py-2 mb-4">
        {tStr("pages.map.batteryNote")}
      </p>

      <div className="app-pro-panel mb-4 p-4 sm:p-5 space-y-3">
        <div>
          <label className="block text-xs text-dark-500 mb-1">
            {formatTpl(tStr("pages.map.visibilityMinutes"), { n: durationMin })}
          </label>
          <input
            type="range"
            min={MAP_VISIBILITY_MIN_MINUTES}
            max={MAP_VISIBILITY_MAX_MINUTES}
            step={15}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full max-w-md h-2 rounded-lg accent-brand-500"
          />
          <p className="text-[11px] text-dark-500 mt-1">
            {formatTpl(tStr("pages.map.visibilityRange"), {
              min: MAP_VISIBILITY_MIN_MINUTES,
              max: MAP_VISIBILITY_MAX_MINUTES,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            disabled={geoBusy || loading}
            onClick={() => startVisibility()}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition"
          >
            {geoBusy ? tStr("pages.map.savingLocation") : tStr("pages.map.visibleOnMap")}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => stopVisibility()}
            className="px-4 py-2.5 rounded-xl border border-dark-600 text-sm text-dark-300 hover:bg-dark-700 disabled:opacity-50 transition"
          >
            {tStr("pages.map.stopVisibility")}
          </button>
        </div>
        {!loading && data?.me?.mapVisibleUntil && (
          <p className="text-sm text-emerald-600">
            {tStr("pages.map.visibleRemaining")}{" "}
            <strong>{remainingLabel(data.me.mapVisibleUntil)}</strong>
          </p>
        )}
      </div>

      {error && (
        <p className="mb-3 text-amber-600 text-sm" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <AppProLoading label={tStr("pages.map.loadingMap")} className="py-12" />
      ) : data ? (
        <MapView data={data} viewerUserId={viewerUserId} />
      ) : null}
    </div>
  );
}
