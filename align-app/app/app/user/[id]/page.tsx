"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";
import { displayName } from "@/lib/displayName";
import { track } from "@/lib/tracking";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { OptimizedImage } from "@/components/OptimizedImage";
import { QuickCallButtons } from "@/components/QuickCallButtons";
import { AddFriendButton } from "@/components/AddFriendButton";

type FriendStatusApi = "pending_sent" | "pending_received" | "accepted" | "rejected" | null;

type UserPublic = User & {
  online?: boolean;
  distanceKm?: number;
  lastActivityAt?: number;
  friendStatus?: FriendStatusApi;
};

function formatDistance(km: number | undefined): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${(Math.round(km * 10) / 10).toFixed(1).replace(".", ",")} km`;
}

export default function PublicUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setError((d.error as string) || "Profil negăsit.");
          setUser(null);
          return;
        }
        if (d.user) {
          setUser(d.user as UserPublic);
          setError(null);
        }
      })
      .catch(() => {
        setError("Eroare rețea.");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă profilul…</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="py-12 text-center px-4">
        <p className="text-dark-500 mb-4">{error || "Profil negăsit."}</p>
        <Link href="/app/profiles" className="text-brand-400 hover:underline">
          Înapoi la toate profilurile
        </Link>
      </div>
    );
  }

  const name = displayName(user.username ?? user.name);
  const distanceStr =
    typeof user.distanceKm === "number" ? formatDistance(user.distanceKm) : null;
  const photos = user.photos?.filter(Boolean) ?? [];

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
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-dark-500 hover:text-white transition shrink-0"
          aria-label="Înapoi la profiluri"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold truncate">{name}</h1>
      </div>

      <div className="rounded-2xl overflow-hidden border border-dark-600 bg-dark-800 mb-4">
        <div className="w-full h-52 sm:h-60 bg-dark-700 overflow-hidden">
          <SilhouetteAvatar
            photoUrl={photos[0]}
            gender={user.gender}
            name={user.name}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover"
          />
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {user.online ? (
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Online
              </span>
            ) : user.lastActivityAt != null ? (
              <span className="text-dark-500">
                Activ acum {Math.max(0, Math.floor((Date.now() - user.lastActivityAt) / 60000))} min
              </span>
            ) : (
              <span className="text-dark-500">Offline</span>
            )}
            {distanceStr != null && (
              <>
                <span className="text-dark-600">·</span>
                <span className="text-dark-400">{distanceStr}</span>
              </>
            )}
          </div>

          {user.bio?.trim() && <p className="text-dark-300 text-sm whitespace-pre-wrap">{user.bio.trim()}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <AddFriendButton
              userId={user.id}
              friendStatus={user.friendStatus ?? null}
              onStatusChange={refetch}
              variant="big"
            />
            <QuickCallButtons toUserId={user.id} size="md" />
            <Link
              href={`/app/chat/${user.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/25 text-brand-400 hover:bg-brand-500/35 border border-brand-500/40 transition text-sm font-medium"
            >
              <MessageCircle className="w-5 h-5" />
              Mesaj
            </Link>
          </div>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="mb-4">
          <h2 className="text-sm font-medium text-dark-400 mb-2">Poze</h2>
          <div className="grid grid-cols-2 gap-2">
            {photos.slice(1).map((src, i) => (
              <div key={`${i}-${src.slice(0, 40)}`} className="relative aspect-square rounded-xl overflow-hidden bg-dark-700 border border-dark-600">
                <OptimizedImage src={src} alt="" fill className="object-cover" sizes="(max-width: 512px) 50vw, 256px" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4">
        <h2 className="text-sm font-medium text-dark-400 mb-2">Detalii</h2>
        <div className="divide-y divide-dark-700/0">
          {row("Vârstă", user.age != null ? `${user.age} ani` : undefined)}
          {row(
            "Gen",
            user.gender === "male" ? "Bărbat" : user.gender === "female" ? "Femeie" : user.gender === "other" ? "Altul" : undefined
          )}
          {row("Înălțime", user.height != null ? `${user.height} cm` : undefined)}
          {row("Greutate", user.weight != null ? `${user.weight} kg` : undefined)}
          {row("Ochi", user.eyeColor)}
          {row("Păr", user.hairColor)}
          {row("Tip corp", user.bodyType)}
          {row("Stil vestimentar", user.clothingStyle)}
          {row("Țară", user.country)}
          {row("Oraș", user.city)}
          {row("Cod poștal", user.postalCode)}
          {row("Educație", user.educationLevel)}
          {row("Ocupație", user.occupation)}
          {row("Statut marital", user.maritalStatus)}
          {row("Copii", user.wantsChildren)}
          {row("Trăsături", user.distinctiveFeatures)}
          {row("Atu fizic", user.physicalAsset)}
          {row("Detaliu atu", user.physicalAssetDetail)}
          {row("Preferințe partener", user.partnerPhysicalPreferences)}
          {row("Stil de viață partener", user.partnerLifestyle)}
          {row("Neacceptat la partener", user.partnerDealBreakers)}
          {user.trust_score != null && row("Trust", `${user.trust_score}`)}
        </div>
      </div>
    </div>
  );
}
