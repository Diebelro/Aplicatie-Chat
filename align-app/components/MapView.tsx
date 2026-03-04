"use client";

import { useEffect, useState } from "react";

const DEFAULT_CENTER = { lat: 45.9432, lng: 24.9668 }; // România

export type MapData = {
  me: { lat: number; lng: number } | null;
  users: { id: string; name: string; lat: number; lng: number }[];
};

function getBbox(me: MapData["me"], users: MapData["users"]) {
  const points = me ? [me, ...users] : users;
  if (points.length === 0) return null;
  let minLat = points[0].lat, maxLat = points[0].lat, minLng = points[0].lng, maxLng = points[0].lng;
  points.forEach((p) => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  });
  const pad = 0.02;
  return { minLat: minLat - pad, minLng: minLng - pad, maxLat: maxLat + pad, maxLng: maxLng + pad };
}

function MapViewLeaflet({ data }: { data: MapData }) {
  const [L, setL] = useState<typeof import("react-leaflet") | null>(null);

  useEffect(() => {
    import("react-leaflet").then(setL);
    import("leaflet/dist/leaflet.css");
  }, []);

  const center = data.me ?? DEFAULT_CENTER;
  const points = data.me ? [data.me, ...data.users] : data.users;

  if (!L) {
    const bbox = getBbox(data.me, data.users);
    const bboxStr = bbox
      ? `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
      : `${center.lng - 0.1},${center.lat - 0.1},${center.lng + 0.1},${center.lat + 0.1}`;
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;
    return (
      <div className="w-full h-[min(70vh,560px)] rounded-xl overflow-hidden border border-dark-600 bg-dark-800">
        <iframe title="Harta" src={embedUrl} className="w-full h-full border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, useMap } = L;

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
      <MapContainer center={[center.lat, center.lng]} zoom={points.length > 0 ? 10 : 6} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        {data.me && (
          <Marker position={[data.me.lat, data.me.lng]}>
            <Popup>Tu</Popup>
          </Marker>
        )}
        {data.users.map((u) => (
          <Marker key={u.id} position={[u.lat, u.lng]}>
            <Popup>{u.name}</Popup>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}

export default function MapView({ data }: { data: MapData }) {
  return <MapViewLeaflet data={data} />;
}
