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
import { AppProLoading } from "@/components/AppProLoading";

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
    return <AppProLoading label={tStr("pages.userPublic.loading")} className="py-24" />;
  }

  if (error || !user) {
    return (
      <div className="max-w-md mx-auto px-5 sm:px-6 py-14">
        <div className="app-pro-empty">
          <p className="app-pro-lead mb-5">{error || tStr("pages.userPublic.notFound")}</p>
          <Link href="/app/profiles" className="text-brand-400 hover:underline">
            {tStr("pages.userPublic.backProfiles")}
          </Link>
        </div>
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
      <div className="flex flex-col gap-1 border-b border-dark-700/80 py-3.5 last:border-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-1 sm:py-3">
        <span className="text-[13px] font-medium leading-snug text-dark-500 sm:w-[9rem] sm:shrink-0 sm:text-sm sm:font-normal">{label}</span>
        <span className="text-[15px] leading-relaxed text-dark-200 sm:flex-1 sm:text-sm sm:leading-relaxed">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-lg pb-12 sm:max-w-xl sm:pb-14">
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <Link
          href="/app/profiles"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-lg text-dark-500 transition hover:bg-dark-800/80 hover:text-zinc-900"
          aria-label={tStr("pages.userPublic.backAria")}
        >
          ←
        </Link>
        <h1 className="app-pro-page-title min-w-0 flex-1 truncate leading-tight sm:text-[1.65rem]">
          {name}
        </h1>
      </div>

      <ProfilePhotoLightbox
        portalReady={photoPortalReady}
        photos={photos}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
        tStr={tStr}
      />

      <div className="mb-5 overflow-hidden rounded-2xl border border-dark-600 bg-dark-800 shadow-sm sm:mb-6">
        <div className="relative aspect-[3/4] min-h-[12rem] w-full max-h-[min(72dvh,34rem)] overflow-hidden bg-dark-700 sm:max-h-[min(78dvh,38rem)] md:max-h-[min(82dvh,40rem)]">
          <SilhouetteAvatar
            photoUrl={photos[0]}
            gender={user.gender}
            name={user.name}
            shape="rectangle"
            className="w-full h-full"
            imgClassName="w-full h-full object-cover object-[center_14%] pointer-events-none select-none"
            imageSizes="(max-width: 512px) 100vw, 512px"
          />
          {photos.length > 1 && (
            <span className="absolute top-2 left-2 z-[2] rounded-full bg-black/65 text-white text-xs px-2 py-1 tabular-nums pointer-events-none">
              {formatTpl(tStr("pages.userPublic.photosBadge"), { n: photos.length })}
            </span>
          )}
          {photos.length > 0 && (
            <>
              <button
                type="button"
                className="absolute inset-0 z-[1] cursor-zoom-in border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                onClick={() => setLightboxIndex(0)}
                title={
                  photos.length > 1
                    ? tStr("pages.userPublic.photoTapMany")
                    : tStr("pages.userPublic.photoTapOne")
                }
                aria-label={tStr("pages.userPublic.galleryAria")}
              />
              <span
                className="pointer-events-none absolute bottom-2 right-2 z-[2] flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white shadow-lg"
                aria-hidden
              >
                <Images className="h-5 w-5 sm:h-6 sm:w-6 opacity-95" />
              </span>
            </>
          )}
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] leading-6 text-dark-400 sm:text-base">
            {user.online ? (
              <span className="flex items-center gap-2 text-green-400">
                <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
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
                <span className="text-dark-600" aria-hidden>
                  ·
                </span>
                <span className="text-dark-400">{distanceStr}</span>
              </>
            )}
          </div>

          {user.bio?.trim() && (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-dark-300 sm:text-base sm:leading-relaxed">{user.bio.trim()}</p>
          )}

          {photos.length > 1 && (
            <button
              type="button"
              onClick={scrollToGallery}
              className="w-full rounded-xl py-2.5 text-left text-[15px] font-medium leading-snug text-brand-400 transition hover:bg-brand-500/10 hover:text-brand-300 sm:py-2"
            >
              <span className="underline decoration-brand-400/50 underline-offset-2">
                {formatTpl(tStr("pages.userPublic.seePhotos"), { n: photos.length })}
              </span>
              <span className="mt-1 block text-[13px] font-normal leading-relaxed text-dark-500 no-underline sm:mt-0 sm:inline sm:pl-1">
                {tStr("pages.userPublic.scrollHint")}
              </span>
            </button>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-stretch">
            <AddFriendButton
              userId={user.id}
              friendStatus={user.friendStatus ?? null}
              onStatusChange={refetch}
              variant="big"
              className="min-h-[48px] w-full justify-center sm:w-auto sm:min-h-0"
            />
            <QuickCallButtons
              toUserId={user.id}
              size="md"
              className="relative z-10 flex w-full flex-wrap justify-center gap-3 sm:w-auto sm:justify-start"
            />
            <Link
              href={`/app/chat/${user.id}`}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/25 px-4 py-3 text-[15px] font-medium text-brand-400 transition hover:bg-brand-500/35 sm:w-auto sm:min-h-0 sm:py-2.5 sm:text-sm"
            >
              <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
              {tStr("pages.userPublic.message")}
            </Link>
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <div id="profile-photos" className="mb-6 scroll-mt-6 sm:mb-8">
          <h2 className="mb-3 text-base font-medium leading-snug text-dark-400 sm:text-[0.95rem]">
            {photos.length > 1
              ? formatTpl(tStr("pages.userPublic.photosMany"), { n: photos.length })
              : tStr("pages.userPublic.photosOne")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {photos.map((src, i) => (
              <button
                key={`${i}-${src.slice(0, 48)}`}
                type="button"
                className="relative aspect-[3/4] w-full max-h-[min(42dvh,18rem)] sm:max-h-[min(38dvh,20rem)] rounded-xl overflow-hidden bg-dark-700 border border-dark-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 p-0 mx-auto"
                onClick={() => setLightboxIndex(i)}
                aria-label={formatTpl(tStr("pages.userPublic.photoCounterAria"), { i: i + 1, n: photos.length })}
              >
                <OptimizedImage
                  src={src}
                  alt=""
                  fill
                  className="object-cover object-[center_12%]"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
                  quality={88}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dark-600 bg-dark-800 px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="mb-3 text-base font-medium leading-snug text-dark-400 sm:text-[0.95rem]">{tStr("pages.userPublic.details")}</h2>
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
