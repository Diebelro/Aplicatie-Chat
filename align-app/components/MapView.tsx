"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DivIcon } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapData = {
  me: {
    lat: number;
    lng: number;
    photoUrl: string | null;
    mapVisibleUntil: string | null;
  } | null;
  users: {
    id: string;
    name: string;
    username: string;
    lat: number;
    lng: number;
    photoUrl: string | null;
    online: boolean;
  }[];
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function avatarIcon(photoUrl: string | null, label: string, isMe: boolean): DivIcon {
  const initial = (label?.trim()?.[0] ?? "?").toUpperCase();
  const img = photoUrl?.trim()
    ? `<img src="${escapeHtml(encodeURI(photoUrl.trim()))}" alt="" />`
    : `<span class="map-fallback">${escapeHtml(initial)}</span>`;
  return L.divIcon({
    html: `<div class="map-avatar-marker ${isMe ? "map-avatar-me" : ""}">${img}</div>`,
    className: "map-avatar-divicon",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -36],
  });
}

/**
 * Leaflet imperativ — marker pe medalion; clic duce la /app/user/[id].
 */
export default function MapView({
  data,
  viewerUserId,
}: {
  data: MapData;
  viewerUserId: string | null;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const points: L.LatLngExpression[] = [];
    const map = L.map(el).setView([46.8, 24.9], 6);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const goProfile = (userId: string) => {
      router.push(`/app/user/${encodeURIComponent(userId)}`);
    };

    const markers: L.Marker[] = [];

    if (data.me && viewerUserId) {
      const m = L.marker([data.me.lat, data.me.lng], {
        icon: avatarIcon(data.me.photoUrl, "Tu", true),
      }).addTo(map);
      m.on("click", () => goProfile(viewerUserId));
      markers.push(m);
      points.push([data.me.lat, data.me.lng]);
    }

    for (const u of data.users) {
      const m = L.marker([u.lat, u.lng], {
        icon: avatarIcon(u.photoUrl, u.name || u.username, false),
      }).addTo(map);
      m.on("click", () => goProfile(u.id));
      markers.push(m);
      points.push([u.lat, u.lng]);
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data, viewerUserId, router]);

  return (
    <div
      ref={wrapRef}
      className="w-full h-[min(70vh,560px)] rounded-xl overflow-hidden border border-dark-600 bg-dark-800 [&_.leaflet-container]:rounded-xl [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full"
    />
  );
}
