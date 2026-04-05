"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Images, MessageCircle } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { displayName } from "@/lib/displayName";
import { track } from "@/lib/tracking";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { OptimizedImage } from "@/components/OptimizedImage";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { AddFriendButton } from "@/components/AddFriendButton";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";
import { formatKmDistance } from "@/lib/i18n/formatKmDistance";
import { translateApiErrorMessage } from "@/lib/i18n/translateApiError";
import { ProfilePhotoLightbox } from "@/components/ProfilePhotoLightbox";

type FriendStatusApi = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

type UserPublic = User & {
  online?: boolean;
  distanceKm?: number;
  lastActivityAt?: number;
  friendStatus?: FriendStatusApi;
};

export default function PublicUserProfilePage() {
  const { tStr, locale } = useI18n();
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) ?? "";
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** null = închis, 0..photos.length-1 = poză în vizualizare mare */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [photoPortalReady, setPhotoPortalReady] = useState(false);

  const meRaw = typeof window !== "undefined" ? getStoredUserRaw() : null;
  const me: User | null = meRaw
    ? (() => {
        try {
          return JSON.parse(meRaw) as User;
        } catch {
          return null;
        }
      })()
    : null;

  const refetch = useCallback(() => {
    fetch(`/api/users/${id}`, { headers: getAuthHeaders(), credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          const raw = String((d.error as string) ?? "").trim();
          setError(raw ? translateApiErrorMessage(raw, tStr) || raw : tStr("pages.userPublic.notFound"));
          setUser(null);
          return;
        }
        if (d.user) {
          setUser(d.user as UserPublic);
          setError(null);
        }
      })
      .catch(() => {
        setError(tStr("pages.userPublic.networkError"));
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [id, tStr]);

  useEffect(() => {
    if (!id) return;
    if (me?.id === id) {
      router.replace("/app/profile");
      return;
    }
    setLoading(true);
    refetch();
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ profileId: id }),
    })
      .then(() => track.view_profile(id))
      .catch(() => {});
  }, [id, me?.id, router, refetch]);

  useEffect(() => {
    setPhotoPortalReady(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">{tStr("pages.userPublic.loading")}</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="py-12 text-center px-4">
        <p className="text-dark-500 mb-4">{error || tStr("pages.userPublic.notFound")}</p>
        <Link href="/app/profiles" className="text-brand-400 hover:underline">
          {tStr("pages.userPublic.backProfiles")}
        </Link>
      </div>
    );
  }

  const name = displayName(user.username ?? user.name);
  const distanceStr =
    typeof user.distanceKm === "number" ? formatKmDistance(user.distanceKm, locale, tStr) : null;
  const photos = user.photos?.filter(Boolean) ?? [];
  const scrollToGallery = () => {
    document.getElementById("profile-photos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const row = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    return (
      <div className="flex flex-wrap gap-x-2 gap-y-0 text-sm border-b border-dark-700/80 py-2 last:border-0">
        <span className="text-dark-500 shrink-0 min-w-[8rem]">{label}</span>
        <span className="text-dark-200">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/app/profiles"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-dark-500 hover:text-zinc-900 transition shrink-0"
          aria-label={tStr("pages.userPublic.backAria")}
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold truncate">{name}</h1>
      </div>

      <ProfilePhotoLightbox
        portalReady={photoPortalReady}
        photos={photos}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
        tStr={tStr}
      />

      <div className="rounded-2xl overflow-hidden border border-dark-600 bg-dark-800 mb-4">
        {/*
          Întreaga poză nu mai e un singur buton: altfel atingeri lângă Apel deschideau galeria
          și părea că „vrea video dar vede poza de profil”. Galeria doar din iconița din colț.
        */}
        <div className="relative w-full h-52 sm:h-60 bg-dark-700 overflow-hidden">
          <SilhouetteAvatar
            photoUrl={photos[0]}
            gender={user.gender}
            name={user.name}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover pointer-events-none select-none"
          />
          {photos.length > 1 && (
            <span className="absolute top-2 left-2 rounded-full bg-black/65 text-white text-xs px-2 py-1 tabular-nums pointer-events-none">
              {formatTpl(tStr("pages.userPublic.photosBadge"), { n: photos.length })}
            </span>
          )}
          {photos.length > 0 && (
            <button
              type="button"
              className="absolute bottom-2 right-2 z-[2] flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black/90 active:scale-95 border border-white/20 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              onClick={() => setLightboxIndex(0)}
              title={
                photos.length > 1
                  ? tStr("pages.userPublic.photoTapMany")
                  : tStr("pages.userPublic.photoTapOne")
              }
              aria-label={tStr("pages.userPublic.galleryAria")}
            >
              <Images className="h-5 w-5 sm:h-6 sm:w-6 opacity-95" aria-hidden />
            </button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {user.online ? (
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {tStr("pages.userPublic.online")}
              </span>
            ) : user.lastActivityAt != null ? (
              <span className="text-dark-500">
                {formatTpl(tStr("pages.userPublic.activeAgo"), {
                  n: Math.max(0, Math.floor((Date.now() - user.lastActivityAt) / 60000)),
                })}
              </span>
            ) : (
              <span className="text-dark-500">{tStr("pages.userPublic.offline")}</span>
            )}
            {distanceStr != null && (
              <>
                <span className="text-dark-600">·</span>
                <span className="text-dark-400">{distanceStr}</span>
              </>
            )}
          </div>

          {user.bio?.trim() && <p className="text-dark-300 text-sm whitespace-pre-wrap">{user.bio.trim()}</p>}

          {photos.length > 1 && (
            <button
              type="button"
              onClick={scrollToGallery}
              className="text-sm text-brand-400 hover:text-brand-300 font-medium underline underline-offset-2"
            >
              {formatTpl(tStr("pages.userPublic.seePhotos"), { n: photos.length })}{" "}
              <span className="text-dark-500 font-normal no-underline">{tStr("pages.userPublic.scrollHint")}</span>
            </button>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <AddFriendButton
              userId={user.id}
              friendStatus={user.friendStatus ?? null}
              onStatusChange={refetch}
              variant="big"
            />
            <QuickCallButtons toUserId={user.id} size="md" className="relative z-10" />
            <Link
              href={`/app/chat/${user.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/25 text-brand-400 hover:bg-brand-500/35 border border-brand-500/40 transition text-sm font-medium"
            >
              <MessageCircle className="w-5 h-5" />
              {tStr("pages.userPublic.message")}
            </Link>
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <div id="profile-photos" className="mb-4 scroll-mt-4">
          <h2 className="text-sm font-medium text-dark-400 mb-2">
            {photos.length > 1
              ? formatTpl(tStr("pages.userPublic.photosMany"), { n: photos.length })
              : tStr("pages.userPublic.photosOne")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((src, i) => (
              <button
                key={`${i}-${src.slice(0, 48)}`}
                type="button"
                className="relative aspect-square rounded-xl overflow-hidden bg-dark-700 border border-dark-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 w-full p-0"
                onClick={() => setLightboxIndex(i)}
                aria-label={formatTpl(tStr("pages.userPublic.photoCounterAria"), { i: i + 1, n: photos.length })}
              >
                <OptimizedImage src={src} alt="" fill className="object-cover" sizes="(max-width: 512px) 33vw, 200px" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4">
        <h2 className="text-sm font-medium text-dark-400 mb-2">{tStr("pages.userPublic.details")}</h2>
        <div className="divide-y divide-dark-700/0">
          {row(
            tStr("pages.userPublic.labelAge"),
            user.age != null ? formatTpl(tStr("pages.userPublic.ageYears"), { n: user.age }) : undefined
          )}
          {row(
            tStr("pages.userPublic.labelGender"),
            user.gender === "male"
              ? tStr("pages.signup.genderMale")
              : user.gender === "female"
                ? tStr("pages.signup.genderFemale")
                : user.gender === "other"
                  ? tStr("pages.signup.genderOther")
                  : undefined
          )}
          {row(
            tStr("pages.userPublic.labelHeight"),
            user.height != null ? formatTpl(tStr("pages.userPublic.heightCm"), { n: user.height }) : undefined
          )}
          {row(
            tStr("pages.userPublic.labelWeight"),
            user.weight != null ? formatTpl(tStr("pages.userPublic.weightKg"), { n: user.weight }) : undefined
          )}
          {row(tStr("pages.userPublic.labelEyes"), user.eyeColor)}
          {row(tStr("pages.userPublic.labelHair"), user.hairColor)}
          {row(tStr("pages.userPublic.labelBodyType"), user.bodyType)}
          {row(tStr("pages.userPublic.labelClothingStyle"), user.clothingStyle)}
          {row(tStr("pages.userPublic.labelCountry"), user.country)}
          {row(tStr("pages.userPublic.labelCity"), user.city)}
          {row(tStr("pages.userPublic.labelPostal"), user.postalCode)}
          {row(tStr("pages.userPublic.labelEducation"), user.educationLevel)}
          {row(tStr("pages.userPublic.labelOccupation"), user.occupation)}
          {row(tStr("pages.userPublic.labelMarital"), user.maritalStatus)}
          {row(tStr("pages.userPublic.labelChildren"), user.wantsChildren)}
          {row(tStr("pages.userPublic.labelFeatures"), user.distinctiveFeatures)}
          {row(tStr("pages.userPublic.labelPhysicalAsset"), user.physicalAsset)}
          {row(tStr("pages.userPublic.labelPhysicalDetail"), user.physicalAssetDetail)}
          {row(tStr("pages.userPublic.labelPartnerPrefs"), user.partnerPhysicalPreferences)}
          {row(tStr("pages.userPublic.labelPartnerLifestyle"), user.partnerLifestyle)}
          {row(tStr("pages.userPublic.labelPartnerDealbreakers"), user.partnerDealBreakers)}
          {user.trust_score != null && row(tStr("pages.userPublic.labelTrust"), `${user.trust_score}`)}
        </div>
      </div>
    </div>
  );
}
