"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DivIcon } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { displayName } from "@/lib/displayName";

const DEFAULT_CENTER = { lat: 45.9432, lng: 24.9668 }; // România

export type MapData = {
  me: { lat: number; lng: number; photoUrl?: string | null } | null;
  users: {
    id: string;
    name: string;
    username?: string;
    lat: number;
    lng: number;
    photoUrl?: string | null;
    online?: boolean;
  }[];
};

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

/** Medalion circular: tu = turcoaz; alții = verde dacă online, gri offline — ca înainte. */
function createAvatarDivIcon(
  photoUrl: string | null | undefined,
  name: string,
  variant: "me" | "other",
  online?: boolean
): DivIcon {
  const border =
    variant === "me" ? "#14b8a6" : online !== false ? "#51CF66" : "#64748b";
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const innerSize = 46;
  const pad = 3;
  const outer = innerSize + pad * 2;

  const fallback = `<div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;overflow:hidden;background:#1e293b;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1.1rem;font-weight:700;">${escapeHtmlAttr(initial)}</div>`;

  const inner = photoUrl?.trim()
    ? `<div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;overflow:hidden;background:#1e293b;">
         <img src="${escapeHtmlAttr(photoUrl.trim())}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;user-select:none" draggable="false" referrerpolicy="no-referrer" />
       </div>`
    : fallback;

  const html = `<div style="width:${outer}px;height:${outer}px;padding:${pad}px;border-radius:50%;background:${border};box-shadow:0 4px 16px rgba(0,0,0,0.4);box-sizing:border-box;cursor:pointer;">${inner}</div>`;

  return L.divIcon({
    className: "map-avatar-divicon",
    html,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer],
    popupAnchor: [0, -outer],
  });
}

/**
 * Leaflet imperativ (fără MapContainer din react-leaflet) — evită „Map container is already initialized”
 * la Strict Mode / dublă montare, păstrând cercurile cu poza ca înainte.
 */
export default function MapView({
  data,
  viewerUserId,
}: {
  data: MapData;
  /** ID cont curent (din storage) — pentru click pe markerul „tu” → /app/user/[id] */
  viewerUserId: string | null;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    }

    const center = data.me ?? DEFAULT_CENTER;
    const points = data.me ? [data.me, ...data.users] : [...data.users];

    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom: points.length > 0 ? 10 : 6,
      tapTolerance: 28,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (data.me) {
      const icon = createAvatarDivIcon(data.me.photoUrl, "Eu", "me");
      const selfMarker = L.marker([data.me.lat, data.me.lng], {
        icon,
        interactive: true,
        bubblingMouseEvents: false,
      }).addTo(map);
      selfMarker.bindTooltip(
        viewerUserId
          ? "Tu (poziția ta) — apasă pentru profil"
          : "Tu (poziția ta)",
        { direction: "top", offset: [0, -6], opacity: 1 }
      );
      if (viewerUserId) {
        let lastNavSelf = 0;
        const openSelf = () => {
          const now = Date.now();
          if (now - lastNavSelf < 400) return;
          lastNavSelf = now;
          startTransition(() => {
            try {
              routerRef.current.push(`/app/user/${viewerUserId}`);
            } catch {
              window.location.assign(`/app/user/${viewerUserId}`);
            }
          });
        };
        selfMarker.on("click", openSelf);
        selfMarker.on("add", () => {
          if (cancelled) return;
          const iconEl = selfMarker.getElement?.() ?? null;
          if (!iconEl) return;
          const stopForMap = (domEv: Event) => {
            domEv.stopPropagation();
          };
          iconEl.addEventListener("mousedown", stopForMap, true);
          iconEl.addEventListener("touchstart", stopForMap, { capture: true, passive: true });
        });
      }
    }

    for (const u of data.users) {
      const icon = createAvatarDivIcon(u.photoUrl, u.name, "other", u.online !== false);
      const label = escapeHtmlAttr(displayName(u.username ?? u.name));
      const isOnline = u.online !== false;
      const statusColor = isOnline ? "#16a34a" : "#64748b";
      const statusText = isOnline ? "Online" : "Offline";
      const uid = u.id;
      /** bubblingMouseEvents: false — altfel harta primește evenimentul și pornește drag în loc de click pe marker. */
      const m = L.marker([u.lat, u.lng], { icon, interactive: true, bubblingMouseEvents: false }).addTo(map);
      m.bindTooltip(
        `<div style="min-width:130px;line-height:1.35;pointer-events:none">
          <div style="font-weight:600;color:#0f172a">${label}</div>
          <div style="color:${statusColor};font-size:12px;font-weight:600">${statusText}</div>
          <div style="font-size:11px;color:#475569;margin-top:4px">Apasă → profil</div>
        </div>`,
        { direction: "top", offset: [0, -6], opacity: 1, interactive: false }
      );
      let lastNav = 0;
      const openProfile = () => {
        const now = Date.now();
        if (now - lastNav < 400) return;
        lastNav = now;
        startTransition(() => {
          try {
            routerRef.current.push(`/app/user/${uid}`);
          } catch {
            window.location.assign(`/app/user/${uid}`);
          }
        });
      };
      m.on("click", openProfile);
      /**
       * Fără asta, Leaflet folosește mousedown pe containerul hărții pentru pan — click-ul pe cerc nu
       * se transformă în „click” pe marker (frecvent pe desktop și mobil).
       */
      m.on("add", () => {
        if (cancelled) return;
        const iconEl = typeof m.getElement === "function" ? m.getElement() : null;
        if (!iconEl) return;
        const stopForMap = (domEv: Event) => {
          domEv.stopPropagation();
        };
        iconEl.addEventListener("mousedown", stopForMap, true);
        iconEl.addEventListener("touchstart", stopForMap, { capture: true, passive: true });
      });
    }

    if (points.length > 1) {
      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      const pad = 0.01;
      map.fitBounds(
        [
          [Math.min(...lats) - pad, Math.min(...lngs) - pad],
          [Math.max(...lats) + pad, Math.max(...lngs) + pad],
        ],
        { padding: [24, 24], maxZoom: 14 }
      );
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
    }

    const t = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
  }, [data, router, viewerUserId]);

  return (
    <div className="w-full h-[min(70vh,560px)] rounded-xl overflow-hidden border border-dark-600 bg-dark-800 [&_.leaflet-container]:rounded-xl [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full">
      <div ref={containerRef} className="h-full min-h-[min(70vh,560px)] w-full" />
    </div>
  );
}
