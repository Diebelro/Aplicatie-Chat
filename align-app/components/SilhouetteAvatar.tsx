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

/** Grid profiluri: lățimea reală a benzii foto → srcset potrivit (fără upscale slab). */
const DEFAULT_SIZES_RECT = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
/** Avatar rotund în liste / header: ~64–128px CSS, 2× retina. */
const DEFAULT_SIZES_CIRCLE = "(max-width: 768px) 30vw, 128px";

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
  /**
   * `circle` = avatar rotund (implicit). `rectangle` = bandă foto dreptunghiulară (ex. card profil);
   * altfel `rounded-full` pe lățime mare taie poza în formă de oval.
   */
  shape?: "circle" | "rectangle";
  /** Pentru next/image `sizes` când e poză cu `fill` (claritate pe carduri / retina). */
  imageSizes?: string;
}

/**
 * Afișează poza utilizatorului, sau imaginea implicită după gen (femeie/bărbat), sau gradient + inițială.
 */
export function SilhouetteAvatar({
  photoUrl,
  gender,
  name,
  className = "",
  imgClassName = "w-full h-full object-cover object-center",
  shape = "circle",
  imageSizes,
}: SilhouetteAvatarProps) {
  const defaultByGender =
    gender === "female" ? DEFAULT_AVATAR_FEMALE : gender === "male" ? DEFAULT_AVATAR_MALE : null;
  const src = photoUrl || defaultByGender;
  const radiusClass = shape === "rectangle" ? "rounded-none" : "rounded-full";

  if (src) {
    const fillSizes =
      imageSizes ?? (shape === "rectangle" ? DEFAULT_SIZES_RECT : DEFAULT_SIZES_CIRCLE);
    return (
      <div className={`relative w-full h-full overflow-hidden ${radiusClass} ${className}`.trim()}>
        <OptimizedImage src={src} alt="" fill sizes={fillSizes} className={imgClassName} />
      </div>
    );
  }

  const initial = name?.trim()?.[0]?.toUpperCase();
  const gradient = getGradient(gender);
  const fallbackBox =
    shape === "rectangle"
      ? `flex items-center justify-center bg-gradient-to-br ${gradient} w-full h-full max-w-full max-h-full ${radiusClass}`
      : `flex items-center justify-center bg-gradient-to-br ${gradient} aspect-square w-full h-full max-w-full max-h-full ${radiusClass}`;

  return (
    <div className={`${fallbackBox} ${className}`.trim()} aria-hidden>
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
