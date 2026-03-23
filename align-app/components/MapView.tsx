"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DivIcon } from "leaflet";
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
    /** Dacă lipsește (API vechi), tratăm ca online pe in-memory. */
    online?: boolean;
  }[];
};

function getBbox(me: MapData["me"], users: MapData["users"]) {
  const points = me ? [me, ...users] : users;
  if (points.length === 0) return null;
  let minLat = points[0].lat,
    maxLat = points[0].lat,
    minLng = points[0].lng,
    maxLng = points[0].lng;
  points.forEach((p) => {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  });
  const pad = 0.02;
  return { minLat: minLat - pad, minLng: minLng - pad, maxLat: maxLat + pad, maxLng: maxLng + pad };
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

/** Medalion circular pe hartă. Tu = turcoaz; alții = verde dacă online, gri dacă offline. */
function createAvatarDivIcon(
  L: typeof import("leaflet"),
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
         <img src="${escapeHtmlAttr(photoUrl.trim())}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" referrerpolicy="no-referrer" />
       </div>`
    : fallback;

  const html = `<div style="width:${outer}px;height:${outer}px;padding:${pad}px;border-radius:50%;background:${border};box-shadow:0 4px 16px rgba(0,0,0,0.4);box-sizing:border-box;">${inner}</div>`;

  return L.divIcon({
    className: "map-avatar-divicon",
    html,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer],
    popupAnchor: [0, -outer],
  });
}

function MapViewLeaflet({ data }: { data: MapData }) {
  const router = useRouter();
  const [L, setL] = useState<typeof import("react-leaflet") | null>(null);
  const [Leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    Promise.all([import("react-leaflet"), import("leaflet")]).then(([RL, leafMod]) => {
      setL(RL);
      setLeaflet(leafMod.default);
    });
    import("leaflet/dist/leaflet.css");
  }, []);

  const center = data.me ?? DEFAULT_CENTER;
  const points = data.me ? [data.me, ...data.users] : data.users;

  const meIcon = useMemo(() => {
    if (!Leaflet || !data.me) return null;
    return createAvatarDivIcon(Leaflet, data.me.photoUrl, "Eu", "me");
  }, [Leaflet, data.me?.lat, data.me?.lng, data.me?.photoUrl]);

  const userIcons = useMemo(() => {
    if (!Leaflet) return new Map<string, DivIcon>();
    const m = new Map<string, DivIcon>();
    for (const u of data.users) {
      const online = u.online !== undefined ? u.online : true;
      m.set(u.id, createAvatarDivIcon(Leaflet, u.photoUrl, u.name, "other", online));
    }
    return m;
  }, [Leaflet, data.users]);

  if (!L || !Leaflet) {
    const bbox = getBbox(data.me, data.users);
    const bboxStr = bbox
      ? `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
      : `${center.lng - 0.1},${center.lat - 0.1},${center.lng + 0.1},${center.lat + 0.1}`;
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;
    return (
      <div className="w-full h-[min(70vh,560px)] rounded-xl overflow-hidden border border-dark-600 bg-dark-800">
        <iframe
          title="Harta"
          src={embedUrl}
          className="w-full h-full border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Tooltip, useMap } = L;

  function FitBounds({ points: pts }: { points: { lat: number; lng: number }[] }) {
    const map = useMap();
    useEffect(() => {
      if (!map || pts.length === 0) return;
      if (pts.length === 1) {
        map.setView([pts[0].lat, pts[0].lng], 12);
        return;
      }
      const lats = pts.map((p) => p.lat);
      const lngs = pts.map((p) => p.lng);
      const pad = 0.01;
      map.fitBounds(
        [
          [Math.min(...lats) - pad, Math.min(...lngs) - pad],
          [Math.max(...lats) + pad, Math.max(...lngs) + pad],
        ],
        { padding: [24, 24], maxZoom: 14 }
      );
    }, [map, pts]);
    return null;
  }

  return (
    <div className="w-full h-[min(70vh,560px)] rounded-xl overflow-hidden border border-dark-600 bg-dark-800 [&_.leaflet-container]:rounded-xl">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={points.length > 0 ? 10 : 6}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {data.me && meIcon && (
          <Marker position={[data.me.lat, data.me.lng]} icon={meIcon}>
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              Tu (poziția ta)
            </Tooltip>
          </Marker>
        )}
        {data.users.map((u) => {
          const icon = userIcons.get(u.id);
          const label = displayName(u.username ?? u.name);
          const isOnline = u.online !== undefined ? u.online : true;
          return (
            <Marker
              key={u.id}
              position={[u.lat, u.lng]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  router.push(`/app/user/${u.id}`);
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div style={{ minWidth: 130, lineHeight: 1.35 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{label}</div>
                  <div style={{ color: isOnline ? "#16a34a" : "#64748b", fontSize: 12, fontWeight: 600 }}>
                    {isOnline ? "Online" : "Offline"}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Apasă → profil</div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

export default function MapView({ data }: { data: MapData }) {
  return <MapViewLeaflet data={data} />;
}
