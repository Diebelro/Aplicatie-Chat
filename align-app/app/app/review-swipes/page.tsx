"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Heart, X, ChevronRight } from "lucide-react";
import type { User } from "@/lib/store";
import { SilhouetteAvatar } from "@/components/SilhouetteAvatar";
import { OptimizedImage } from "@/components/OptimizedImage";
import { displayName } from "@/lib/displayName";
import { getAuthHeaders } from "@/lib/authClient";
import { track } from "@/lib/tracking";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";

type Profile = User & { mySwipeLiked: boolean };

export default function ReviewSwipesPage() {
  const { tStr } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusId = searchParams?.get("focus")?.trim() || null;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [matchModal, setMatchModal] = useState<{ toId: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/swipes/review-queue", { headers: getAuthHeaders(), credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tStr("pages.reviewSwipes.errGeneric"));
        setProfiles([]);
        return;
      }
      let list = (data.profiles || []) as Profile[];
      if (focusId) {
        const i = list.findIndex((p) => p.id === focusId);
        if (i > 0) {
          const [item] = list.splice(i, 1);
          list = [item, ...list];
        }
      }
      setProfiles(list);
      setIndex(0);
    } catch {
      setError(tStr("pages.reviewSwipes.errNetwork"));
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [focusId, tStr]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = profiles[index] ?? null;

  const goNextLocal = () => {
    setIndex((i) => {
      if (profiles.length <= 1) return 0;
      return i >= profiles.length - 1 ? 0 : i + 1;
    });
  };

  /** Doar treci mai departe — fără POST, nu se salvează nimic. */
  const skipWithoutSave = () => {
    goNextLocal();
  };

  const submitSwipe = async (liked: boolean) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "same-origin",
        body: JSON.stringify({ toId: current.id, liked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tStr("pages.reviewSwipes.errSave"));
        setBusy(false);
        return;
      }
      if (data.unchanged) {
        goNextLocal();
        setBusy(false);
        return;
      }
      if (liked) track.like_sent(current.id);
      if (data.matchCreated) {
        track.match_created(current.id);
        setMatchModal({
          toId: current.id,
          name: displayName(current.username ?? current.name) || tStr("pages.reviewSwipes.someone"),
        });
      }
      setProfiles((prev) =>
        prev.map((p) => (p.id === current.id ? { ...p, mySwipeLiked: liked } : p))
      );
      goNextLocal();
    } finally {
      setBusy(false);
    }
  };

  const emptyAfterLoad = !loading && profiles.length === 0;

  const progress = useMemo(
    () => (profiles.length ? `${Math.min(index + 1, profiles.length)} / ${profiles.length}` : ""),
    [index, profiles.length]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">{tStr("pages.reviewSwipes.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {matchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMatchModal(null)}
        >
          <div
            className="bg-dark-800 border border-dark-600 rounded-2xl p-6 max-w-sm w-full shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-semibold text-zinc-900 mb-1">{tStr("pages.reviewSwipes.matchTitle")}</p>
            <p className="text-dark-300 mb-6">
              {formatTpl(tStr("pages.reviewSwipes.matchBody"), { name: matchModal.name })}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMatchModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-dark-600 text-dark-300 hover:bg-dark-700"
              >
                {tStr("pages.reviewSwipes.close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/app/chat/${matchModal.toId}`);
                  setMatchModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 text-zinc-900 font-medium hover:bg-brand-600"
              >
                {tStr("pages.reviewSwipes.message")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold">{tStr("pages.reviewSwipes.title")}</h2>
        <Link href="/app/matches" className="text-sm text-brand-400 hover:underline shrink-0">
          {tStr("pages.reviewSwipes.backMatches")}
        </Link>
      </div>

      <p className="text-dark-500 text-sm mb-4 w-full">{tStr("pages.reviewSwipes.explainer")}</p>

      {error && (
        <p className="text-amber-400 text-sm mb-3 w-full" role="alert">
          {error}
        </p>
      )}

      {emptyAfterLoad ? (
        <p className="text-dark-500 text-center py-12">{tStr("pages.reviewSwipes.empty")}</p>
      ) : current ? (
        <>
          <p className="text-xs text-dark-500 mb-2 w-full">{progress}</p>
          <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 relative">
            <Link
              href={`/app/user/${current.id}`}
              className="absolute inset-0 z-0 block relative rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
              aria-label={formatTpl(tStr("pages.matches.viewProfileAria"), {
                name: displayName(current.username ?? current.name),
              })}
            >
              {current.photos?.[0] ? (
                <OptimizedImage
                  src={current.photos[0]}
                  alt=""
                  fill
                  sizes="(max-width: 480px) 100vw, 384px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-8 bg-dark-700">
                  <SilhouetteAvatar
                    photoUrl={null}
                    gender={current.gender}
                    name={current.name}
                    className="w-full max-w-[70%] h-full max-h-[70%] text-dark-600"
                  />
                </div>
              )}
            </Link>
            <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-black/20 p-5 pointer-events-none">
              <h3 className="text-xl font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_16px_rgba(0,0,0,0.5)]">
                {displayName(current.username ?? current.name)}
              </h3>
              <p className="text-xs mt-1 mb-2">
                <span
                  className={
                    current.mySwipeLiked
                      ? "text-brand-400 font-medium"
                      : "text-dark-400"
                  }
                >
                  {tStr("pages.reviewSwipes.decision")}{" "}
                  {current.mySwipeLiked ? tStr("pages.reviewSwipes.like") : tStr("pages.reviewSwipes.pass")}
                </span>
              </p>
              <p className="text-white/95 text-sm line-clamp-4 [text-shadow:0_1px_4px_rgba(0,0,0,0.92)]">
                {current.bio || tStr("pages.reviewSwipes.noBio")}
              </p>
            </div>
          </div>

          <div className="w-full flex flex-col gap-3 mt-5">
            <div className="flex justify-center items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitSwipe(false)}
                className="w-14 h-14 rounded-full bg-dark-600 hover:bg-red-500/25 flex items-center justify-center text-red-400 border-2 border-red-500/50 disabled:opacity-50"
                title={tStr("pages.reviewSwipes.saveNoTitle")}
              >
                <X className="w-7 h-7" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitSwipe(true)}
                className="w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-400 flex items-center justify-center text-dark-900 border-2 border-brand-400/50 disabled:opacity-50"
                title={tStr("pages.reviewSwipes.saveLikeTitle")}
              >
                <Heart className="w-7 h-7" />
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={skipWithoutSave}
              className="w-full py-3 rounded-xl border border-dark-600 text-dark-300 hover:bg-dark-800 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {tStr("pages.reviewSwipes.skip")} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
