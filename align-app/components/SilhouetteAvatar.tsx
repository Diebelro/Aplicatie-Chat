"use client";

/**
 * Fără poză: imagini implicite din `/public/avatars/` (siluetă spate / portret artistic),
 * afișate cu `object-contain` + fundal închis ca să nu arate ca „gradient gol” la crop.
 * Fără gen: gradient + inițială / icon.
 */
import type { ReactNode } from "react";
import { User } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import type { Gender } from "@/lib/store";

const DEFAULT_AVATAR_FEMALE = "/avatars/female-default.jpg";
const DEFAULT_AVATAR_MALE = "/avatars/male-default-1.jpg";

/** Grid profiluri: lățimea reală a benzii foto → srcset potrivit (fără upscale slab). */
const DEFAULT_SIZES_RECT = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
/** Avatar rotund în liste / header: ~64–128px CSS, 2× retina. */
const DEFAULT_SIZES_CIRCLE = "(max-width: 768px) 30vw, 128px";

/** Imaginile implicite au mult negru la margini; contain + letterbox le face lizibile în cerc. */
const STOCK_IMG_CLASS = "absolute inset-0 w-full h-full object-contain object-center bg-zinc-950";

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
  /** Gen – când nu e poză, imaginea implicită femeie/bărbat din `/public/avatars/` */
  gender?: Gender | null;
  /** Nume pentru inițială (doar când nu e poză și nu e imagine implicită pe gen) */
  name?: string;
  className?: string;
  imgClassName?: string;
  shape?: "circle" | "rectangle";
  imageSizes?: string;
}

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
  const radiusClass = shape === "rectangle" ? "rounded-none" : "rounded-full";

  if (photoUrl) {
    const fillSizes =
      imageSizes ?? (shape === "rectangle" ? DEFAULT_SIZES_RECT : DEFAULT_SIZES_CIRCLE);
    return (
      <div className={`relative w-full h-full overflow-hidden ${radiusClass} ${className}`.trim()}>
        <OptimizedImage src={photoUrl} alt="" fill sizes={fillSizes} className={imgClassName} />
      </div>
    );
  }

  if (defaultByGender) {
    const fillSizes =
      imageSizes ?? (shape === "rectangle" ? DEFAULT_SIZES_RECT : DEFAULT_SIZES_CIRCLE);
    return (
      <div className={`relative w-full h-full overflow-hidden ${radiusClass} ${className}`.trim()}>
        <OptimizedImage src={defaultByGender} alt="" fill sizes={fillSizes} className={STOCK_IMG_CLASS} />
      </div>
    );
  }

  const initial = name?.trim()?.[0]?.toUpperCase();
  const gradient = getGradient(gender);
  const fallbackBox =
    shape === "rectangle"
      ? `flex items-center justify-center bg-gradient-to-br ${gradient} w-full h-full max-w-full max-h-full ${radiusClass}`
      : `flex items-center justify-center bg-gradient-to-br ${gradient} aspect-square w-full h-full max-w-full max-h-full ${radiusClass}`;

  const iconClass = "w-[45%] h-[45%] text-white/95 shrink-0";
  let body: ReactNode;
  if (initial) {
    body = (
      <span className="text-white font-semibold select-none drop-shadow-sm text-5xl leading-none">
        {initial}
      </span>
    );
  } else {
    body = <User className={iconClass} strokeWidth={2} aria-hidden />;
  }

  return (
    <div className={`${fallbackBox} ${className}`.trim()} aria-hidden>
      {body}
    </div>
  );
}
