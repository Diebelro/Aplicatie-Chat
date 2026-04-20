"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Video, Users, Search, X, Loader2, ArrowRight, Mic, Check } from "lucide-react";
import { fetchWithAuthRetry } from "@/lib/authClient";
import { getConferenceRoomId } from "@/lib/videoCall";
import { displayName } from "@/lib/displayName";
import {
  getAudioConstraints,
  getVideoConstraints,
  isMobileDevice,
} from "@/lib/webrtc/mediaConstraints";

type ProfileRow = {
  id: string;
  name: string;
  username: string;
  online?: boolean;
};

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

export default function StartConferencePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [invitees, setInvitees] = useState<ProfileRow[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Conferință video: microfon + cameră testate aici; doar audio: doar microfon. */
  const [conferenceAudioOnly, setConferenceAudioOnly] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [camOk, setCamOk] = useState(false);
  const [testingMic, setTestingMic] = useState(false);
  const [testingCam, setTestingCam] = useState(false);
  const [preflightHint, setPreflightHint] = useState<string | null>(null);

  const mediaReady = conferenceAudioOnly ? micOk : micOk && camOk;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ name: debounced });
    void fetchWithAuthRetry(`/api/profiles?${params}`, { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setResults([]);
          return;
        }
        const d = (await r.json()) as { profiles?: ProfileRow[] };
        const list = Array.isArray(d.profiles) ? d.profiles : [];
        setResults(list.filter((p) => p.id).slice(0, 25));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const addInvitee = useCallback((p: ProfileRow) => {
    setInvitees((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
  }, []);

  const removeInvitee = useCallback((id: string) => {
    setInvitees((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const requestMicPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPreflightHint("Browserul nu suportă acces la microfon pe această pagină.");
      return;
    }
    setPreflightHint(null);
    setError(null);
    setTestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(),
        video: false,
      });
      stopTracks(stream);
      setMicOk(true);
    } catch {
      setMicOk(false);
      setPreflightHint("Microfon respins sau indisponibil. Permite din bara de adrese / setări site, apoi încearcă din nou.");
    } finally {
      setTestingMic(false);
    }
  }, []);

  const requestCamPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPreflightHint("Browserul nu suportă acces la cameră pe această pagină.");
      return;
    }
    setPreflightHint(null);
    setError(null);
    setTestingCam(true);
    try {
      const prefer1080 =
        !isMobileDevice() && typeof window !== "undefined" && window.innerWidth >= 1200;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: getVideoConstraints(prefer1080),
      });
      stopTracks(stream);
      setCamOk(true);
    } catch {
      setCamOk(false);
      setPreflightHint("Camera a fost respinsă sau nu e disponibilă. Permite camera pentru site sau alege conferință doar audio mai jos.");
    } finally {
      setTestingCam(false);
    }
  }, []);

  const startConference = useCallback(
    async (withInvites: boolean) => {
      setError(null);
      if (!mediaReady) return;
      const roomId = getConferenceRoomId();
      if (withInvites && invitees.length === 0) return;
      const audioOnly = conferenceAudioOnly;
      setStarting(true);
      try {
        if (withInvites && invitees.length > 0) {
          await Promise.all(
            invitees.map((u) =>
              fetchWithAuthRetry("/api/call/ring", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  toId: u.id,
                  roomId,
                  audioOnly,
                }),
              })
            )
          );
        }
        router.push(audioOnly ? `/app/call/${roomId}?audio=1` : `/app/call/${roomId}`);
      } catch {
        setError("Nu am putut porni conferința. Încearcă din nou.");
      } finally {
        setStarting(false);
      }
    },
    [invitees, router, conferenceAudioOnly, mediaReady]
  );

  return (
    <div className="bg-night-900 text-white px-4 py-8 pb-24 sm:pb-28">
      <div className="max-w-lg mx-auto">
        <Link href="/app/messages" className="text-brand-400 text-sm hover:underline inline-flex items-center gap-1">
          ← Înapoi la mesaje
        </Link>

        <div className="mt-6 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Conferință video</h1>
            <p className="text-night-400 text-sm mt-1 leading-relaxed">
              Mai întâi acceptă permisiunile de mai jos (microfon{conferenceAudioOnly ? "" : " și cameră"}), ca la apelul normal.
              Apoi poți invita participanți sau intra singur în sală.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-night-600 bg-night-800/40 p-4 space-y-3">
          <p className="text-sm font-medium text-night-200">Permisiuni înainte de sală</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={testingMic || micOk}
              onClick={() => void requestMicPermission()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-night-700 border border-night-500 text-white hover:bg-night-600 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {testingMic ? (
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              ) : micOk ? (
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Mic className="w-5 h-5 shrink-0 text-brand-400" />
              )}
              {micOk ? "Microfon — permis" : "Permite microfonul"}
            </button>
            {!conferenceAudioOnly && (
              <button
                type="button"
                disabled={testingCam || camOk}
                onClick={() => void requestCamPermission()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-night-700 border border-night-500 text-white hover:bg-night-600 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                {testingCam ? (
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                ) : camOk ? (
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Video className="w-5 h-5 shrink-0 text-brand-400" />
                )}
                {camOk ? "Cameră — permisă" : "Permite camera"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setConferenceAudioOnly((v) => {
                const next = !v;
                if (!next) setCamOk(false);
                setPreflightHint(null);
                return next;
              });
            }}
            className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2 w-full text-left"
          >
            {conferenceAudioOnly
              ? "Vreau video — cere din nou și camera (dezactivează modul doar audio)"
              : "Nu am cameră / conferință doar audio (doar microfon)"}
          </button>
          {preflightHint && <p className="text-amber-200/90 text-xs leading-relaxed">{preflightHint}</p>}
          {!mediaReady && (
            <p className="text-night-500 text-xs">
              {conferenceAudioOnly
                ? "Apasă „Permite microfonul” ca să poți intra sau suna invitații."
                : "Apasă ambele butoane sau treci la conferință doar audio."}
            </p>
          )}
        </div>

        <div className="mt-8 space-y-3">
          <label className="block text-sm text-night-400">Caută utilizatori</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-night-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Minim 2 caractere (nume sau @username)"
              className="w-full bg-night-800 border border-night-600 rounded-xl pl-10 pr-4 py-3 text-white placeholder-night-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoComplete="off"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-400 animate-spin" />
            )}
          </div>
          {debounced.length > 0 && debounced.length < 2 && (
            <p className="text-night-500 text-xs">Continuă să scrii pentru căutare…</p>
          )}
        </div>

        {invitees.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-night-400 mb-2">Invitați ({invitees.length}) — primesc apel ca la un apel normal</p>
            <div className="flex flex-wrap gap-2">
              {invitees.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => removeInvitee(u.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 border border-brand-500/35 pl-3 pr-2 py-1.5 text-sm text-brand-100 hover:bg-brand-500/25 transition"
                >
                  <Video className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  {displayName(u.username || u.name)}
                  <X className="w-4 h-4 text-brand-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {results.filter((p) => !invitees.some((i) => i.id === p.id)).length > 0 && (
          <ul className="mt-4 rounded-xl border border-night-600 bg-night-800/50 divide-y divide-night-600 max-h-60 overflow-y-auto">
            {results
              .filter((p) => !invitees.some((i) => i.id === p.id))
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{displayName(p.username || p.name)}</p>
                    <p className="text-xs text-night-500 truncate">@{p.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addInvitee(p)}
                    className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
                  >
                    Invită
                  </button>
                </li>
              ))}
          </ul>
        )}

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={starting || invitees.length === 0 || !mediaReady}
            onClick={() => void startConference(true)}
            title={
              !mediaReady
                ? "Acceptă mai întâi permisiunile de mai sus"
                : invitees.length === 0
                  ? "Adaugă mai întâi invitați din listă"
                  : undefined
            }
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-500 text-night-900 font-semibold hover:bg-brand-400 disabled:opacity-50 transition"
          >
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            Sună invitații și intră în conferință
          </button>
          <button
            type="button"
            disabled={starting || !mediaReady}
            onClick={() => void startConference(false)}
            title={!mediaReady ? "Acceptă mai întâi permisiunile de mai sus" : undefined}
            className="w-full py-3 rounded-xl border border-night-500 text-night-300 hover:bg-night-800 text-sm disabled:opacity-50"
          >
            Intră singur în sală (fără invitații)
          </button>
        </div>

        <p className="mt-8 mb-2 text-night-500 text-xs leading-relaxed max-w-lg">
          Dacă refuzi odată permisiunea, browserul rămâne pe „Blocat” până o schimbi din lacătul de lângă adresă. Pentru apeluri deja începute, în ecranul galben există și „Încearcă din nou”.
        </p>
      </div>
    </div>
  );
}
