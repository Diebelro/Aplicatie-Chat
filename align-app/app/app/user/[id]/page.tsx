"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Images, MapPin, MessageCircle, ShieldOff, Flag } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { fetchWithAuthRetry } from "@/lib/authClient";
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
import { useVisibleInterval } from "@/lib/useVisibleInterval";
import { getPresencePollMs } from "@/lib/presencePollMs";
import { presenceKind } from "@/lib/presenceLabel";
import { readProfileReturnPath } from "@/lib/listScrollSession";
import { beginTapTrack, endTapTrack, updateTapTrack, type TapTrack } from "@/lib/tapVsScroll";

type FriendStatusApi = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-dark-600/70 bg-dark-800 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-dark-500">{label}</p>
      <p className="mt-0.5 break-words text-[15px] leading-snug text-zinc-900">{value}</p>
    </div>
  );
}

function ProfileBlock({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-dark-600/70 bg-dark-800 px-4 py-4">
      {title ? <h2 className="mb-2 text-sm font-semibold text-zinc-900">{title}</h2> : null}
      {children}
    </section>
  );
}

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
  const photoTapRef = useRef<TapTrack | null>(null);

  const backHref = useMemo(() => readProfileReturnPath("/app/profiles"), []);

  const openPhotoIfTap = useCallback((index: number) => {
    if (!endTapTrack(photoTapRef.current)) {
      photoTapRef.current = null;
      return;
    }
    photoTapRef.current = null;
    setLightboxIndex(index);
  }, []);

  const onPhotoPointerDown = useCallback((clientX: number, clientY: number) => {
    photoTapRef.current = beginTapTrack(clientX, clientY);
  }, []);

  const onPhotoPointerMove = useCallback((clientX: number, clientY: number) => {
    updateTapTrack(photoTapRef.current, clientX, clientY);
  }, []);

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
    fetchWithAuthRetry(`/api/users/${id}`, { cache: "no-store" })
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
    fetchWithAuthRetry("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: id }),
    })
      .then(() => track.view_profile(id))
      .catch(() => {});
  }, [id, me?.id, router, refetch]);

  useEffect(() => {
    setPhotoPortalReady(true);
  }, []);

  const handleBlock = useCallback(async () => {
    if (!confirm(tStr("pages.userPublic.blockConfirm"))) return;
    const res = await fetchWithAuthRetry("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: id }),
    });
    if (res.ok) {
      alert(tStr("pages.userPublic.blockedToast"));
      router.push("/app/profiles");
    }
  }, [id, router, tStr]);

  const handleReport = useCallback(async () => {
    const reason = window.prompt(tStr("pages.userPublic.reportPrompt"));
    if (reason === null) return;
    const res = await fetchWithAuthRetry("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: id,
        reason: reason || tStr("pages.userPublic.reportReasonDefault"),
      }),
    });
    if (res.ok) alert(tStr("pages.userPublic.reportedToast"));
  }, [id, tStr]);

  useVisibleInterval(() => void refetch(), getPresencePollMs(), !!user && !loading && !error);

  if (loading) {
    return <AppProLoading variant="form" label={tStr("pages.userPublic.loading")} className="py-24" />;
  }

  if (error || !user) {
    return (
      <div className="max-w-md mx-auto px-5 sm:px-6 py-14">
        <div className="app-pro-empty">
          <p className="app-pro-lead mb-5">{error || tStr("pages.userPublic.notFound")}</p>
          <Link href={backHref} className="text-brand-400 hover:underline">
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
  const genderLabel =
    user.gender === "male"
      ? tStr("pages.signup.genderMale")
      : user.gender === "female"
        ? tStr("pages.signup.genderFemale")
        : user.gender === "other"
          ? tStr("pages.signup.genderOther")
          : "";
  const locationLine = [user.city, user.country].filter((v) => v && String(v).trim()).join(", ");
  const facts: { label: string; value: string }[] = [];
  const pushFact = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || String(value).trim() === "") return;
    facts.push({ label, value: String(value) });
  };
  pushFact(
    tStr("pages.userPublic.labelAge"),
    user.age != null ? formatTpl(tStr("pages.userPublic.ageYears"), { n: user.age }) : undefined
  );
  pushFact(tStr("pages.userPublic.labelGender"), genderLabel || undefined);
  pushFact(
    tStr("pages.userPublic.labelHeight"),
    user.height != null ? formatTpl(tStr("pages.userPublic.heightCm"), { n: user.height }) : undefined
  );
  pushFact(
    tStr("pages.userPublic.labelWeight"),
    user.weight != null ? formatTpl(tStr("pages.userPublic.weightKg"), { n: user.weight }) : undefined
  );
  pushFact(tStr("pages.userPublic.labelEyes"), user.eyeColor);
  pushFact(tStr("pages.userPublic.labelHair"), user.hairColor);
  pushFact(tStr("pages.userPublic.labelBodyType"), user.bodyType);
  pushFact(tStr("pages.userPublic.labelClothingStyle"), user.clothingStyle);
  pushFact(tStr("pages.userPublic.labelOccupation"), user.occupation);
  pushFact(tStr("pages.userPublic.labelEducation"), user.educationLevel);
  pushFact(tStr("pages.userPublic.labelMarital"), user.maritalStatus);
  pushFact(tStr("pages.userPublic.labelChildren"), user.wantsChildren);
  pushFact(tStr("pages.userPublic.labelPostal"), user.postalCode);
  if (user.trust_score != null) pushFact(tStr("pages.userPublic.labelTrust"), `${user.trust_score}`);

  const longBlocks: { title: string; text: string }[] = [];
  const pushBlock = (title: string, text: string | null | undefined) => {
    const t = text?.trim();
    if (!t) return;
    longBlocks.push({ title, text: t });
  };
  pushBlock(tStr("pages.userPublic.labelFeatures"), user.distinctiveFeatures);
  pushBlock(tStr("pages.userPublic.labelPhysicalAsset"), user.physicalAsset);
  pushBlock(tStr("pages.userPublic.labelPhysicalDetail"), user.physicalAssetDetail);
  pushBlock(tStr("pages.userPublic.labelPartnerPrefs"), user.partnerPhysicalPreferences);
  pushBlock(tStr("pages.userPublic.labelPartnerLifestyle"), user.partnerLifestyle);
  pushBlock(tStr("pages.userPublic.labelPartnerDealbreakers"), user.partnerDealBreakers);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(backHref);
  };

  const kind = presenceKind(user.online, user.lastActivityAt);
  const presence =
    kind === "online" ? (
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-400"
        title={tStr("pages.userPublic.online")}
        aria-label={tStr("pages.userPublic.online")}
      />
    ) : null;
  const metaBits = [
    presence,
    distanceStr != null ? <span key="d">{distanceStr}</span> : null,
    locationLine ? (
      <span key="loc" className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {locationLine}
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="w-full pb-[max(1rem,var(--safe-area-inset-bottom))]">
      <ProfilePhotoLightbox
        portalReady={photoPortalReady}
        photos={photos}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
        tStr={tStr}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-4 lg:pt-4">
        <div className="relative lg:sticky lg:top-3">
          <div className="relative h-[min(72dvh,36rem)] w-full overflow-hidden bg-dark-800 lg:h-[min(78dvh,40rem)] lg:rounded-2xl lg:border lg:border-dark-600">
            <SilhouetteAvatar
              photoUrl={photos[0]}
              gender={user.gender}
              name={user.name}
              shape="rectangle"
              className="pointer-events-none h-full w-full"
              imgClassName="pointer-events-none h-full w-full select-none object-cover object-[center_18%]"
              imageSizes="(max-width: 1024px) 100vw, 352px"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/25" />

            <button
              type="button"
              onClick={goBack}
              className="absolute left-3 top-3 z-[3] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
              aria-label={tStr("pages.userPublic.backAria")}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>

            {photos.length > 1 && (
              <span className="absolute right-3 top-3 z-[3] rounded-full bg-black/65 px-2.5 py-1 text-xs tabular-nums text-white pointer-events-none">
                {formatTpl(tStr("pages.userPublic.photosBadge"), { n: photos.length })}
              </span>
            )}

            {photos.length > 0 && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  className="absolute inset-0 z-[1] cursor-zoom-in border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                  style={{ touchAction: "pan-y" }}
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    if (t) onPhotoPointerDown(t.clientX, t.clientY);
                  }}
                  onTouchMove={(e) => {
                    const t = e.touches[0];
                    if (t) onPhotoPointerMove(t.clientX, t.clientY);
                  }}
                  onTouchEnd={() => openPhotoIfTap(0)}
                  onTouchCancel={() => {
                    photoTapRef.current = null;
                  }}
                  onMouseDown={(e) => onPhotoPointerDown(e.clientX, e.clientY)}
                  onMouseMove={(e) => {
                    if (e.buttons === 1) onPhotoPointerMove(e.clientX, e.clientY);
                  }}
                  onClick={() => openPhotoIfTap(0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLightboxIndex(0);
                    }
                  }}
                  title={
                    photos.length > 1
                      ? tStr("pages.userPublic.photoTapMany")
                      : tStr("pages.userPublic.photoTapOne")
                  }
                  aria-label={tStr("pages.userPublic.galleryAria")}
                />
                <span
                  className="pointer-events-none absolute bottom-[5.75rem] right-3 z-[2] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg sm:h-11 sm:w-11"
                  aria-hidden
                >
                  <Images className="h-5 w-5 opacity-95" />
                </span>
              </>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] px-4 pb-5 pt-16">
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
                {name}
                {user.age != null ? (
                  <span className="font-medium text-white/90">, {user.age}</span>
                ) : null}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                {metaBits.map((bit, i) => (
                  <Fragment key={i}>
                    {i > 0 ? (
                      <span className="text-white/40" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    {bit}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 pt-4 lg:px-0 lg:pt-0">
          <div className="flex items-stretch gap-2">
            <Link
              href={`/app/chat/${user.id}`}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              {tStr("pages.userPublic.message")}
            </Link>
            <QuickCallButtons toUserId={user.id} size="md" className="shrink-0 justify-center" />
          </div>
          <AddFriendButton
            userId={user.id}
            friendStatus={user.friendStatus ?? null}
            onStatusChange={refetch}
            variant="big"
            className="min-h-[48px] w-full justify-center"
          />

          {user.bio?.trim() ? (
            <ProfileBlock>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-dark-300">{user.bio.trim()}</p>
            </ProfileBlock>
          ) : null}

          {facts.length > 0 ? (
            <section>
              <h2 className="mb-2.5 text-sm font-semibold text-zinc-900">{tStr("pages.userPublic.details")}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {facts.map((f) => (
                  <ProfileFact key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            </section>
          ) : null}

          {longBlocks.map((b) => (
            <ProfileBlock key={b.title} title={b.title}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-dark-300">{b.text}</p>
            </ProfileBlock>
          ))}

          {photos.length > 1 ? (
            <section id="profile-photos" className="scroll-mt-4">
              <h2 className="mb-2.5 text-sm font-semibold text-zinc-900">
                {formatTpl(tStr("pages.userPublic.photosMany"), { n: photos.length })}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((src, i) => (
                  <button
                    key={`${i}-${src.slice(0, 48)}`}
                    type="button"
                    className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-dark-600 bg-dark-700 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    style={{ touchAction: "pan-y" }}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      if (t) onPhotoPointerDown(t.clientX, t.clientY);
                    }}
                    onTouchMove={(e) => {
                      const t = e.touches[0];
                      if (t) onPhotoPointerMove(t.clientX, t.clientY);
                    }}
                    onTouchEnd={() => openPhotoIfTap(i)}
                    onTouchCancel={() => {
                      photoTapRef.current = null;
                    }}
                    onMouseDown={(e) => onPhotoPointerDown(e.clientX, e.clientY)}
                    onClick={() => openPhotoIfTap(i)}
                    aria-label={formatTpl(tStr("pages.userPublic.photoCounterAria"), { i: i + 1, n: photos.length })}
                  >
                    <OptimizedImage
                      src={src}
                      alt=""
                      fill
                      className="pointer-events-none object-cover object-[center_12%]"
                      sizes="(max-width: 640px) 30vw, 180px"
                      quality={88}
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pb-2 pt-1">
            <button
              type="button"
              onClick={handleBlock}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-amber-400/90 transition hover:bg-amber-500/10 hover:text-amber-300"
            >
              <ShieldOff className="h-4 w-4 shrink-0" aria-hidden />
              {tStr("pages.userPublic.blockUser")}
            </button>
            <button
              type="button"
              onClick={handleReport}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400/90 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <Flag className="h-4 w-4 shrink-0" aria-hidden />
              {tStr("pages.userPublic.reportUser")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
