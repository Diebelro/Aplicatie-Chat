import type { User } from "@/lib/store";

/** URL gol / invalid → tratat ca „fără poză” (evită chenar negru la <img src="">). */
export function isUsableProfilePhotoUrl(url: string | null | undefined): url is string {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return false;
  if (u.startsWith("data:")) return u.length > 32;
  if (u.startsWith("/") || u.startsWith("http://") || u.startsWith("https://")) return true;
  return false;
}

/** Prima poză validă din listă sau null. */
export function getFirstUsableProfilePhotoUrl(
  photos: (string | null | undefined)[] | null | undefined
): string | null {
  if (!photos?.length) return null;
  for (const p of photos) {
    if (isUsableProfilePhotoUrl(p)) return p.trim();
  }
  return null;
}

/** Returnează URL-ul primei poze de profil (avatar) sau null. */
export function getProfileImageUrl(user: User | null | undefined): string | null {
  return getFirstUsableProfilePhotoUrl(user?.photos ?? null);
}
