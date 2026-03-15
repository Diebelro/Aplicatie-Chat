import type { User } from "@/lib/store";

/** Returnează URL-ul primei poze de profil (avatar) sau null. */
export function getProfileImageUrl(user: User | null | undefined): string | null {
  if (!user?.photos?.length) return null;
  return user.photos[0] ?? null;
}
