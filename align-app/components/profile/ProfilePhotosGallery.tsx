"use client";

import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { OptimizedImage } from "@/components/OptimizedImage";
import { MAX_PHOTOS } from "@/lib/profilePhotoUtils";
import { formatTpl } from "@/lib/i18n/formatTpl";

const labelClass = "block ui-form-label text-sm mb-1";

export type ProfilePhotosGalleryProps = {
  photos: string[];
  maxPhotos?: number;
  onPickFile: (file: File) => void | Promise<void>;
  onRemove: (index: number) => void;
  onSetMain: (index: number) => void;
  tStr: (path: string) => string;
  /** Section id for deep links / scroll (ex. #profile-photos). */
  sectionId?: string;
};

/**
 * Galerie poze profil + radio „poză de profil” — același UI ca pe /app/profile.
 */
export function ProfilePhotosGallery({
  photos,
  maxPhotos = MAX_PHOTOS,
  onPickFile,
  onRemove,
  onSetMain,
  tStr,
  sectionId = "profile-photos",
}: ProfilePhotosGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || photos.length >= maxPhotos) return;
    const file = files[0];
    void onPickFile(file);
    e.target.value = "";
  };

  return (
    <div id={sectionId}>
      <label className={labelClass}>{formatTpl(tStr("pages.profile.photosLabel"), { max: maxPhotos })}</label>
      <p className="text-xs text-dark-500 mb-2">{tStr("pages.profile.photosHint")}</p>
      <div className="flex flex-wrap gap-4 items-start">
        {photos.map((src, i) => (
          <div key={i} className="relative group flex flex-col items-center">
            <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-xl overflow-hidden border border-dark-600 ring-1 ring-dark-600/60">
              <OptimizedImage
                src={src}
                alt=""
                width={128}
                height={128}
                className="h-full w-full object-cover object-[center_12%]"
                sizes="(max-width: 640px) 112px, 128px"
                quality={86}
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1.5 right-1.5 app-touch-target w-8 h-8 min-h-8 min-w-8 rounded-full bg-red-500/95 text-white flex items-center justify-center shadow-md hover:bg-red-500"
                aria-label={tStr("pages.profile.delPhotoAria")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <label className="mt-1.5 flex items-center gap-1.5 cursor-pointer text-xs text-dark-400 hover:text-brand-400 transition">
              <input
                type="radio"
                name="profilePhoto"
                checked={i === 0}
                onChange={() => onSetMain(i)}
                className="rounded-full border-dark-500 text-brand-500 focus:ring-brand-500"
              />
              <span>{i === 0 ? tStr("pages.profile.radioProfilePhoto") : tStr("pages.profile.radioSetProfilePhoto")}</span>
            </label>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-28 w-28 sm:h-32 sm:w-32 min-h-[44px] min-w-[44px] rounded-xl border-2 border-dashed border-dark-600 flex items-center justify-center text-dark-500 hover:border-brand-500 hover:text-brand-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus className="w-8 h-8" />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>
    </div>
  );
}
