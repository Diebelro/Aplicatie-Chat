/**
 * Adresă aproximativă din WGS84 prin OpenStreetMap Nominatim.
 * https://operations.osmfoundation.org/policies/nominatim/ — User-Agent identifică aplicația; fără stocare cache agresiv aici.
 */
const NOMINATIM_REVERSE =
  "https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&accept-language=ro,en";

function nominatimUserAgent(): string {
  const fromEnv = process.env.NOMINATIM_USER_AGENT?.trim();
  if (fromEnv) return fromEnv;
  return "DiebelChat/1.0 (contact@diebel.ro)";
}

function formatFromNominatimJson(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const addr = d.address;
  if (addr && typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    const road = typeof a.road === "string" ? a.road : typeof a.pedestrian === "string" ? a.pedestrian : "";
    const hn = typeof a.house_number === "string" ? a.house_number : "";
    const city =
      typeof a.city === "string"
        ? a.city
        : typeof a.town === "string"
          ? a.town
          : typeof a.village === "string"
            ? a.village
            : typeof a.municipality === "string"
              ? a.municipality
              : "";
    const county = typeof a.county === "string" ? a.county : typeof a.state === "string" ? a.state : "";
    const first = [road && hn ? `${road} ${hn}` : road || hn, city || county].filter(Boolean).join(", ");
    if (first.trim()) return first.trim().slice(0, 280);
  }
  const dn = d.display_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim().slice(0, 280);
  return null;
}

export async function reverseGeocodeWgs84(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url = `${NOMINATIM_REVERSE}&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": nominatimUserAgent(),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json().catch(() => null);
    return formatFromNominatimJson(json);
  } catch {
    return null;
  }
}
