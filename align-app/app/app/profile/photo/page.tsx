"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuthRetry, getAuthHeaders } from "@/lib/authClient";
import type { User } from "@/lib/store";
import { ProfilePhotosGallery } from "@/components/profile/ProfilePhotosGallery";
import { useI18n } from "@/lib/i18n/context";
import { AppProLoading } from "@/components/AppProLoading";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import { MAX_PHOTOS, resizeImageAsDataUrl } from "@/lib/profilePhotoUtils";

export default function ProfilePhotoPage() {
  const { tStr } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchWithAuthRetry("/api/me");
      const data = await res.json();
      if (cancelled) return;
      if (res.ok && data.user) {
        setUser(data.user);
        setPhotos(data.user.photos ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistPhotos = useCallback(
    async (newPhotos: string[]) => {
      if (!user) return;
      setSaving(true);
      setErrorDetail("");
      try {
        const patch = () =>
          fetch("/api/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ photos: newPhotos }),
            credentials: "include",
          });
        let res = await patch();
        if (res.status === 401) {
          await new Promise((r) => setTimeout(r, 450));
          res = await patch();
        }
        const data = await res.json();
        if (res.status === 401) {
          setErrorDetail(tStr("pages.profile.errSessionSave"));
          return;
        }
        if (!res.ok) throw new Error(data.error || "Eroare");
        if (data.user) {
          localStorage.setItem("align_user", JSON.stringify(data.user));
          setUser(data.user);
          setPhotos(data.user.photos ?? []);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("align_user_updated", { detail: data.user }));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setErrorDetail(translateApiErrorMessage(msg, tStr) || msg || tStr("pages.profile.errSave"));
      } finally {
        setSaving(false);
      }
    },
    [user, tStr]
  );

  const handlePhotoPick = (file: File) => {
    if (photos.length >= MAX_PHOTOS) return;
    if (!file.type.startsWith("image/")) return;
    void resizeImageAsDataUrl(file)
      .then(async (dataUrl) => {
        const newPhotos = [...photos.slice(0, MAX_PHOTOS - 1), dataUrl];
        setPhotos(newPhotos);
        await persistPhotos(newPhotos);
      })
      .catch(() => {});
  };

  const handlePhotoRemove = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    void persistPhotos(newPhotos);
  };

  const setProfilePhoto = (index: number) => {
    if (index === 0) return;
    const arr = [...photos];
    const [chosen] = arr.splice(index, 1);
    const newOrder = [chosen, ...arr];
    setPhotos(newOrder);
    void persistPhotos(newOrder);
  };

  if (loading) {
    return <AppProLoading label={tStr("pages.profile.loading")} />;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto app-pro-empty">
        <p className="app-pro-lead mb-4">{tStr("pages.profile.notAuth")}</p>
        <Link href="/login" className="text-brand-400 hover:underline">
          {tStr("pages.profile.login")}
        </Link>
        <span className="text-dark-500 mx-2">{tStr("pages.profile.or")}</span>
        <Link href="/app" className="text-brand-400 hover:underline">
          {tStr("pages.profile.backApp")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/app/profile"
        className="inline-flex min-h-11 items-center text-sm text-brand-400 hover:text-brand-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-1 -ml-1"
      >
        {tStr("pages.profile.photoPage.backLink")}
      </Link>
      <h1 className="app-pro-page-title mt-4">{tStr("pages.profile.photoPage.title")}</h1>
      <p className="ui-subtitle text-sm mt-2 mb-6">{tStr("pages.profile.photoPage.subtitle")}</p>

      <ProfilePhotosGallery
        photos={photos}
        onPickFile={handlePhotoPick}
        onRemove={handlePhotoRemove}
        onSetMain={setProfilePhoto}
        tStr={tStr}
      />

      {saving && <p className="text-sm text-dark-500 mt-4">{tStr("pages.profile.saving")}</p>}
      {errorDetail && <p className="text-sm text-red-400 mt-2">{errorDetail}</p>}
    </div>
  );
}
