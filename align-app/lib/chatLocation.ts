/** Mesaj de chat: locație punctuală stocată în attachment (fără coloane noi în DB). Coordonatele rămân exacte așa cum le trimite clientul (după validare). */
export const ALIGN_LOCATION_CONTENT_TYPE = "application/vnd.align.location+json";
/** Recunoscut la citire pentru extensibilitate (nu îl folosim încă la scriere). */
export const ALIGN_LOCATION_GEOJSON_CONTENT_TYPE = "application/geo+json";

export type AlignLocationPoint = { type: "point"; lat: number; lng: number; label?: string };

const MAX_PAYLOAD_LEN = 800;

function normalizeCoord(n: number): number {
  return Object.is(n, -0) ? 0 : n;
}

const MAX_LABEL_LEN = 280;

export function serializeAlignLocation(lat: number, lng: number, label?: string | null): string {
  const payload: AlignLocationPoint = {
    type: "point",
    lat: normalizeCoord(lat),
    lng: normalizeCoord(lng),
  };
  if (label != null && typeof label === "string") {
    const t = label.trim().slice(0, MAX_LABEL_LEN);
    if (t) payload.label = t;
  }
  return JSON.stringify(payload);
}

/** Validează lat/lng după coercție (număr finit, în interval WGS84). */
export function isValidWgs84LatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Acceptă numere sau stringuri numerice din JSON (anti-abuz: respinge NaN, Infinity). */
export function coerceLatLngFromRequest(latIn: unknown, lngIn: unknown): { lat: number; lng: number } | null {
  const toNum = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return n;
    }
    return NaN;
  };
  const lat = normalizeCoord(toNum(latIn));
  const lng = normalizeCoord(toNum(lngIn));
  if (!isValidWgs84LatLng(lat, lng)) return null;
  return { lat, lng };
}

export type ParsedAlignLocation = { lat: number; lng: number; label?: string };

export function parseAlignLocationPayload(raw: string | null | undefined): ParsedAlignLocation | null {
  if (!raw || raw.length > MAX_PAYLOAD_LEN) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;

    const obj = o as Record<string, unknown>;
    const typ = obj.type;

    const labelRaw = obj.label;
    const label =
      typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim().slice(0, MAX_LABEL_LEN) : undefined;

    if (typ === "Point" && Array.isArray(obj.coordinates)) {
      const c = obj.coordinates as unknown[];
      if (c.length < 2) return null;
      const lng = normalizeCoord(Number(c[0]));
      const lat = normalizeCoord(Number(c[1]));
      if (!isValidWgs84LatLng(lat, lng)) return null;
      return label ? { lat, lng, label } : { lat, lng };
    }

    const latRaw = obj.lat;
    const lngRaw = obj.lng;
    if (latRaw === undefined || lngRaw === undefined) return null;
    const lat = normalizeCoord(typeof latRaw === "number" ? latRaw : Number(latRaw));
    const lng = normalizeCoord(typeof lngRaw === "number" ? lngRaw : Number(lngRaw));
    if (!isValidWgs84LatLng(lat, lng)) return null;

    if (typ === undefined || typ === null || typ === "point") {
      return label ? { lat, lng, label } : { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

export function isAlignLocationContentType(ct: string | null | undefined): boolean {
  const t = (ct ?? "").trim();
  return t === ALIGN_LOCATION_CONTENT_TYPE || t === ALIGN_LOCATION_GEOJSON_CONTENT_TYPE;
}

/** Linie principală în bule: stradă/adresă dacă există, altfel coordonate. */
export function formatLocationPrimaryLine(parsed: ParsedAlignLocation, decimals = 6): string {
  if (parsed.label?.trim()) return parsed.label.trim();
  return formatLocationCoordsExact(parsed.lat, parsed.lng, decimals);
}

/** Afișare coordonate cu precizie mare (fără rotunjire „de confidențialitate”). */
export function formatLocationCoordsExact(lat: number, lng: number, decimals = 6): string {
  const d = Math.max(4, Math.min(8, decimals));
  return `${lat.toFixed(d)}, ${lng.toFixed(d)}`;
}

/** Link public — fără API / facturare Google Maps Platform. */
export function googleMapsUrl(lat: number, lng: number): string {
  const q = `${lat},${lng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}`;
}
