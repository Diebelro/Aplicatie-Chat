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

type Profile = User & { mySwipeLiked: boolean };

export default function ReviewSwipesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusId = searchParams.get("focus")?.trim() || null;

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
        setError(data.error || "Eroare");
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
      setError("Eroare de rețea");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [focusId]);

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
        setError(data.error || "Eroare la salvare");
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
          name: displayName(current.username ?? current.name) || "cineva",
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
        <span className="text-dark-500">Se încarcă istoricul…</span>
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
            <p className="text-lg font-semibold text-white mb-1">Ești match!</p>
            <p className="text-dark-300 mb-6">Poți trimite mesaje lui {matchModal.name}.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMatchModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-dark-600 text-dark-300 hover:bg-dark-700"
              >
                Închide
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/app/chat/${matchModal.toId}`);
                  setMatchModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
              >
                Mesaj
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold">Recenzare swipe</h2>
        <Link href="/app/matches" className="text-sm text-brand-400 hover:underline shrink-0">
          Înapoi la matches
        </Link>
      </div>

      <p className="text-dark-500 text-sm mb-4 w-full">
        Vezi din nou profilele la care ai dat like sau pass.{" "}
        <strong className="text-dark-400">Doar dacă apeși Like sau Nu se salvează</strong> o nouă decizie. „Mai departe”
        doar te duce la următorul profil, fără să schimbe nimic.
      </p>

      {error && (
        <p className="text-amber-400 text-sm mb-3 w-full" role="alert">
          {error}
        </p>
      )}

      {emptyAfterLoad ? (
        <p className="text-dark-500 text-center py-12">Încă nu ai swipe-uri în istoric. Folosește Descoperă.</p>
      ) : current ? (
        <>
          <p className="text-xs text-dark-500 mb-2 w-full">{progress}</p>
          <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-dark-800 border border-dark-600 relative">
            {current.photos?.[0] ? (
              <OptimizedImage
                src={current.photos[0]}
                alt=""
                fill
                sizes="(max-width: 480px) 100vw, 384px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <SilhouetteAvatar
                  photoUrl={null}
                  gender={current.gender}
                  name={current.name}
                  className="w-full max-w-[70%] h-full max-h-[70%] text-dark-600"
                />
              </div>
            )}
            <div className="absolute inset-0 p-5 flex flex-col justify-end bg-gradient-to-t from-black/85 to-transparent">
              <h3 className="text-xl font-bold text-white">{displayName(current.username ?? current.name)}</h3>
              <p className="text-xs mt-1 mb-2">
                <span
                  className={
                    current.mySwipeLiked
                      ? "text-brand-400 font-medium"
                      : "text-dark-400"
                  }
                >
                  Decizia ta acum: {current.mySwipeLiked ? "Like" : "Nu"}
                </span>
              </p>
              <p className="text-gray-300 text-sm line-clamp-4">{current.bio || "Fără descriere."}</p>
            </div>
          </div>

          <div className="w-full flex flex-col gap-3 mt-5">
            <div className="flex justify-center items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitSwipe(false)}
                className="w-14 h-14 rounded-full bg-dark-600 hover:bg-red-500/25 flex items-center justify-center text-red-400 border-2 border-red-500/50 disabled:opacity-50"
                title="Salvează: Nu"
              >
                <X className="w-7 h-7" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitSwipe(true)}
                className="w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-400 flex items-center justify-center text-dark-900 border-2 border-brand-400/50 disabled:opacity-50"
                title="Salvează: Like"
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
              Mai departe (fără schimbare) <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
