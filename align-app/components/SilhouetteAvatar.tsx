"use client";

/**
 * REGULĂ FIXĂ (vezi .cursor/rules/avatar-defaults-fixed.mdc):
 * Când userul nu are poză: femei → female-default.jpg, bărbați → male-default-1.jpg.
 * NU schimba această logică fără cerere explicită.
 */
import { User } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import type { Gender } from "@/lib/store";

const DEFAULT_AVATAR_FEMALE = "/avatars/female-default.jpg";
const DEFAULT_AVATAR_MALE = "/avatars/male-default-1.jpg";

function getGradient(gender?: Gender | null): string {
  switch (gender) {
    case "female":
      return "from-rose-500/80 to-fuchsia-500/80";
    case "male":
      return "from-sky-500/80 to-indigo-500/80";
    default:
      return "from-brand-500/90 to-emerald-500/80";
  }
}

interface SilhouetteAvatarProps {
  /** URL poză sau data URL – dacă există, se afișează poza */
  photoUrl?: string | null;
  /** Gen – când nu e poză, se afișează imaginea implicită femeie/bărbat */
  gender?: Gender | null;
  /** Nume pentru inițială în avatar (când nu e poză și nu e imagine implicită) */
  name?: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Afișează poza utilizatorului, sau imaginea implicită după gen (femeie/bărbat), sau gradient + inițială.
 */
export function SilhouetteAvatar({
  photoUrl,
  gender,
  name,
  className = "",
  imgClassName = "w-full h-full object-cover",
}: SilhouetteAvatarProps) {
  const defaultByGender =
    gender === "female" ? DEFAULT_AVATAR_FEMALE : gender === "male" ? DEFAULT_AVATAR_MALE : null;
  const src = photoUrl || defaultByGender;

  if (src) {
    return (
      <div className={`relative w-full h-full rounded-full overflow-hidden ${className}`.trim()}>
        <OptimizedImage src={src} alt="" fill className="object-cover object-center" />
      </div>
    );
  }

  const initial = name?.trim()?.[0]?.toUpperCase();
  const gradient = getGradient(gender);

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} aspect-square w-full h-full max-w-full max-h-full ${className}`}
      aria-hidden
    >
      {initial ? (
        <span className="text-white font-semibold select-none drop-shadow-sm text-5xl leading-none">
          {initial}
        </span>
      ) : (
        <User className="w-[45%] h-[45%] text-white/90" strokeWidth={2} aria-hidden />
      )}
    </div>
  );
}
