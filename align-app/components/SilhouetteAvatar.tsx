"use client";

/**
 * Fără poză: imagini implicite din `/public/avatars/` (siluetă spate / portret artistic),
 * afișate cu `object-contain` + fundal închis ca să nu arate ca „gradient gol” la crop.
 * Fără gen: gradient + inițială / icon.
 */
import { useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import type { Gender } from "@/lib/store";
import { isUsableProfilePhotoUrl } from "@/lib/profileImage";

const DEFAULT_AVATAR_FEMALE = "/avatars/female-default.jpg";
const DEFAULT_AVATAR_MALE = "/avatars/male-default-1.jpg";

/** Grid profiluri: lățimea reală a benzii foto → srcset potrivit (fără upscale slab). */
const DEFAULT_SIZES_RECT = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
/** Avatar rotund în liste / header: ~64–128px CSS, 2× retina. */
const DEFAULT_SIZES_CIRCLE = "(max-width: 768px) 30vw, 128px";

/**
 * Imaginile implicite pe gen (fotografii artistice pe fundal deschis). Le servim ca fișier
 * static (fără optimizatorul `/_next/image`, care pica pe ele → chenar negru) și le umplem
 * cadrul cu `object-cover` pe fundal deschis neutru.
 */
const STOCK_IMG_CLASS = "absolute inset-0 w-full h-full object-cover object-center bg-zinc-100";

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
  /** Priority loading pentru prima imagine vizibilă (above the fold). */
  priority?: boolean;
}

export function SilhouetteAvatar({
  photoUrl,
  gender,
  name,
  className = "",
  imgClassName = "w-full h-full object-cover object-center",
  shape = "circle",
  imageSizes,
  priority = false,
}: SilhouetteAvatarProps) {
  const [photoError, setPhotoError] = useState(false);
  const [defaultError, setDefaultError] = useState(false);

  const usablePhoto =
    isUsableProfilePhotoUrl(photoUrl) && !photoError ? photoUrl.trim() : null;
  const defaultByGender =
    gender === "female" ? DEFAULT_AVATAR_FEMALE : gender === "male" ? DEFAULT_AVATAR_MALE : null;
  const radiusClass = shape === "rectangle" ? "rounded-none" : "rounded-full";

  if (usablePhoto) {
    const fillSizes =
      imageSizes ?? (shape === "rectangle" ? DEFAULT_SIZES_RECT : DEFAULT_SIZES_CIRCLE);
    return (
      <div className={`relative w-full h-full overflow-hidden ${radiusClass} ${className}`.trim()}>
        <OptimizedImage
          src={usablePhoto}
          alt=""
          fill
          sizes={fillSizes}
          className={imgClassName}
          priority={priority}
          onError={() => setPhotoError(true)}
        />
      </div>
    );
  }

  // Imaginile-siluetă (fotografii pe gen) le folosim DOAR pe cardurile dreptunghiulare (grila
  // discover). Sunt fișiere statice mari pe care optimizatorul `/_next/image` le respinge
  // (400 → chenar negru), așa că le servim direct ca `<img>` și, la eșec, cădem pe gradient.
  if (defaultByGender && shape === "rectangle" && !defaultError) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${radiusClass} ${className}`.trim()}>
        <img
          src={defaultByGender}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={STOCK_IMG_CLASS}
          onError={() => setDefaultError(true)}
        />
      </div>
    );
  }

  const initial = name?.trim()?.[0]?.toUpperCase();
  const gradient = getGradient(gender);
  // `[container-type:size]` + unități `cqmin` = inițiala/iconul scalează cu mărimea cercului
  // (32px în liste, 44px header, 100px+ pe profil) fără să iasă în afară.
  const fallbackBox =
    shape === "rectangle"
      ? `flex items-center justify-center [container-type:size] bg-gradient-to-br ${gradient} w-full h-full max-w-full max-h-full ${radiusClass}`
      : `flex items-center justify-center [container-type:size] bg-gradient-to-br ${gradient} aspect-square w-full h-full max-w-full max-h-full ${radiusClass}`;

  let body: ReactNode;
  if (initial) {
    body = (
      <span className="text-white font-semibold select-none drop-shadow-sm leading-none text-[52cqmin]">
        {initial}
      </span>
    );
  } else {
    body = <User className="w-[48cqmin] h-[48cqmin] text-white/95 shrink-0" strokeWidth={2} aria-hidden />;
  }

  return (
    <div className={`${fallbackBox} ${className}`.trim()} aria-hidden>
      {body}
    </div>
  );
}
