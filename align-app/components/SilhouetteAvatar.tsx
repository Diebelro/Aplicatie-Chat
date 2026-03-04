"use client";

import { User } from "lucide-react";
import type { Gender } from "@/lib/store";

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
  /** Gen pentru culoarea avatarului când nu e poză */
  gender?: Gender | null;
  /** Nume pentru inițială în avatar */
  name?: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Afișează fie poza utilizatorului, fie un avatar cu gradient și inițială (sau pictogramă).
 */
export function SilhouetteAvatar({
  photoUrl,
  gender,
  name,
  className = "",
  imgClassName = "w-full h-full object-cover",
}: SilhouetteAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={imgClassName}
      />
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
