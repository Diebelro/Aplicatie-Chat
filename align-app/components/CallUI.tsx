"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  RefreshCw,
  MonitorUp,
  ChevronLeft,
  Volume2,
  VolumeX,
  Smartphone,
  Headphones,
} from "lucide-react";
import { useWebRtcCall, type RemoteParticipant } from "@/hooks/useWebRtcCall";
import { getAuthHeaders } from "@/lib/authClient";
import { isScreenshareFeatureEnabled } from "@/lib/env/webrtcConfig";
import { markIncomingCallDismissed } from "@/lib/callIncomingDismiss";
import {
  DEFAULT_AUDIO_SINK,
  applyAudioSinkId,
  listAudioOutputDevices,
  pickSpeakerLikeSinkId,
  supportsAudioOutputSelection,
} from "@/lib/webrtc/audioOutput";
import { isMobileDevice } from "@/lib/webrtc/mediaConstraints";

/** Ieșire audio pentru stream-ul remot + opțiune „nu aud pe aici” (confidențialitate). */
type RemoteAudioPlayback = {
  sinkId: string;
  /** true = volum 0 pe vocea celuilalt; microfonul tău nu e afectat */
  remoteMuted: boolean;
};

const defaultRemotePlayback: RemoteAudioPlayback = {
  sinkId: DEFAULT_AUDIO_SINK,
  remoteMuted: false,
};

const RemotePlaybackContext = createContext<RemoteAudioPlayback>(defaultRemotePlayback);

function fmtCallDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const { sinkId, remoteMuted } = useContext(RemotePlaybackContext);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.volume = remoteMuted ? 0 : 1;
    void applyAudioSinkId(el, sinkId);
    return () => {
      el.srcObject = null;
    };
  }, [stream, sinkId, remoteMuted]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

/** Card mic (conferință / layout clasic). */
function RemoteVideoCard({ participant }: { participant: RemoteParticipant }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    const stream = participant.stream;
    if (!el) return;
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [participant.stream]);

  const hasLiveVideo =
    participant.stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled) ?? false;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-night-800 border border-white/10 aspect-video shadow-xl">
      {hasLiveVideo ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-night-800 to-night-950 text-night-400 gap-2">
          <span className="text-3xl font-semibold text-white/40">
            {(participant.displayName || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="text-xs">Fără video</span>
        </div>
      )}
      {participant.stream?.getAudioTracks().length ? <RemoteAudio stream={participant.stream} /> : null}
      <span className="absolute bottom-2 left-2 text-xs bg-black/55 backdrop-blur-sm px-2 py-1 rounded-lg truncate max-w-[85%]">
        {participant.displayName || participant.id}
      </span>
    </div>
  );
}

/** Remote pe tot ecranul (apel 1-la-1 video). */
function RemoteVideoStage({ participant }: { participant: RemoteParticipant }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    const stream = participant.stream;
    if (!el) return;
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [participant.stream]);

  const hasLiveVideo =
    participant.stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled) ?? false;

  return (
    <>
      {hasLiveVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-black to-zinc-950">
          <div className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center text-4xl font-light text-white/50 mb-4 ring-2 ring-white/15">
            {(participant.displayName || "?").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-white/45 text-sm font-medium tracking-wide">Fără video de la celălalt</p>
        </div>
      )}
      {participant.stream?.getAudioTracks().length ? <RemoteAudio stream={participant.stream} /> : null}
    </>
  );
}

const OUTGOING_POLL_MS = 1000;
/** După conectare, ascundem bara de controale ca să nu stea peste imagine; tap / mișcare mouse reafișează. */
const CHROME_AUTO_HIDE_MS = 4500;

type CallUIProps = {
  roomId: string;
  userId: string;
  displayName: string;
  audioOnly: boolean;
  isConference: boolean;
  isCaller?: boolean;
};

export default function CallUI({
  roomId,
  userId,
  displayName,
  audioOnly,
  isConference,
  isCaller: isCallerProp,
}: CallUIProps) {
  const router = useRouter();
  const [callRejected, setCallRejected] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** false = celălalt pe tot ecranul, tu în colț; true = invers */
  const [videoLayoutSwapped, setVideoLayoutSwapped] = useState(false);
  const isCaller = !!isCallerProp && !isConference;

  const screenshareAllowed = isScreenshareFeatureEnabled();

  const {
    status,
    error,
    permissionHelp,
    remoteParticipants,
    muted,
    setMuted,
    videoMuted,
    setVideoMuted,
    leave,
    localStream,
    banner,
    canSwitchCamera,
    screenSharing,
    switchCamera,
    toggleScreenShare,
    retryPermissions,
  } = useWebRtcCall({
    roomId,
    userId,
    displayName,
    audioOnly,
    isCaller,
    isConference,
    onAutoEnded: () => {
      markIncomingCallDismissed(roomId);
      void fetch("/api/call/end", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ roomId }),
      }).catch(() => {});
      router.push("/app/messages");
    },
  });

  /** Pe telefon comutăm față/spate prin facingMode chiar dacă enumerateDevices raportează un singur videoinput. */
  const showCameraFlip = !audioOnly && (canSwitchCamera || isMobileDevice());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const v = localVideoRef.current;
    const a = localAudioRef.current;
    if (v) v.srcObject = localStream;
    if (a) a.srcObject = localStream;
    return () => {
      if (v) v.srcObject = null;
      if (a) a.srcObject = null;
    };
  }, [localStream, videoLayoutSwapped]);

  useEffect(() => {
    if (status !== "connected") {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  const [chromeVisible, setChromeVisible] = useState(true);
  /** În browser setTimeout returnează number; evită conflict cu tipul Node `Timeout`. */
  const chromeHideTimerRef = useRef<number | null>(null);
  const lastMoveBumpRef = useRef(0);

  const scheduleChromeHide = useCallback(() => {
    if (chromeHideTimerRef.current) {
      clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
    }
    setChromeVisible(true);
    if (status !== "connected") return;
    chromeHideTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
      chromeHideTimerRef.current = null;
    }, CHROME_AUTO_HIDE_MS);
  }, [status]);

  useEffect(() => {
    scheduleChromeHide();
    return () => {
      if (chromeHideTimerRef.current) {
        clearTimeout(chromeHideTimerRef.current);
        chromeHideTimerRef.current = null;
      }
    };
  }, [scheduleChromeHide]);

  const onImmersivePointer = useCallback(
    (e: React.PointerEvent) => {
      if (e.type === "pointermove" && e.pointerType === "mouse") {
        const now = Date.now();
        if (now - lastMoveBumpRef.current < 450) return;
        lastMoveBumpRef.current = now;
      }
      scheduleChromeHide();
    },
    [scheduleChromeHide]
  );

  /** Implicit: ieșirea default a browserului/OS; pe mobil: butonul Difuzor forțează setSinkId spre difuzor dacă există. */
  const [speakerOutputOn, setSpeakerOutputOn] = useState(false);
  const [speakerSinkIdResolved, setSpeakerSinkIdResolved] = useState<string | undefined>(undefined);
  /**
   * Mod discret: fără sunet „în ambele sensuri” la tine — nu mai auzi celălalt și microfonul tău
   * e oprit ca să nu audă foșnet / ambient; la ieșire se restaurează cum era microfonul înainte.
   */
  const [privacyQuietMode, setPrivacyQuietMode] = useState(false);
  const micBeforePrivacyRef = useRef<boolean | null>(null);
  const isMobileUi = isMobileDevice();

  const exitPrivacyQuietMode = useCallback(() => {
    const prev = micBeforePrivacyRef.current;
    micBeforePrivacyRef.current = null;
    setPrivacyQuietMode(false);
    setMuted(prev ?? false);
  }, [setMuted]);

  const togglePrivacyQuietMode = useCallback(() => {
    if (privacyQuietMode) {
      exitPrivacyQuietMode();
    } else {
      micBeforePrivacyRef.current = muted;
      setMuted(true);
      setPrivacyQuietMode(true);
    }
  }, [privacyQuietMode, muted, setMuted, exitPrivacyQuietMode]);

  const onMicToggle = useCallback(() => {
    if (privacyQuietMode) {
      exitPrivacyQuietMode();
      return;
    }
    setMuted(!muted);
  }, [privacyQuietMode, exitPrivacyQuietMode, muted, setMuted]);

  useEffect(() => {
    if (status === "connected") return;
    if (!privacyQuietMode) return;
    exitPrivacyQuietMode();
  }, [status, privacyQuietMode, exitPrivacyQuietMode]);

  useEffect(() => {
    if (!supportsAudioOutputSelection()) return;
    void listAudioOutputDevices().then((devs) => {
      setSpeakerSinkIdResolved(pickSpeakerLikeSinkId(devs));
    });
  }, [status]);

  const remoteAudioSinkId = useMemo(() => {
    if (!supportsAudioOutputSelection()) return DEFAULT_AUDIO_SINK;
    if (speakerOutputOn && speakerSinkIdResolved) return speakerSinkIdResolved;
    return DEFAULT_AUDIO_SINK;
  }, [speakerOutputOn, speakerSinkIdResolved]);

  const remotePlayback = useMemo(
    () => ({
      sinkId: remoteAudioSinkId,
      remoteMuted: privacyQuietMode,
    }),
    [remoteAudioSinkId, privacyQuietMode]
  );

  /** Doar pe mobil: pe desktop lăsăm ieșirea implicită (boxe/căști după OS). */
  const showSpeakerToggle = isMobileUi && supportsAudioOutputSelection() && !!speakerSinkIdResolved;

  const fetchOutgoingStatus = useCallback(() => {
    fetch(`/api/call/outgoing-status?roomId=${encodeURIComponent(roomId)}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "rejected") setCallRejected(true);
      })
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    if (!isCaller) return;
    fetchOutgoingStatus();
    const t = setInterval(fetchOutgoingStatus, OUTGOING_POLL_MS);
    return () => clearInterval(t);
  }, [isCaller, fetchOutgoingStatus]);

  useEffect(() => {
    if (!callRejected) return;
    const t = setTimeout(() => router.push("/app/messages"), 2500);
    return () => clearTimeout(t);
  }, [callRejected, router]);

  const handleLeave = () => {
    leave();
    markIncomingCallDismissed(roomId);
    void (async () => {
      try {
        await fetch("/api/call/end", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ roomId }),
        });
      } catch {
        /* ignore */
      }
      router.push("/app/messages");
    })();
  };

  const remote = remoteParticipants[0];
  const immersiveVideo = !isConference && !audioOnly;
  const immersiveAudio = !isConference && audioOnly;

  const canSwapVideoLayout = Boolean(remote && localStream);
  const toggleVideoLayout = useCallback(() => {
    if (!remote || !localStream) return;
    setVideoLayoutSwapped((s) => !s);
  }, [remote, localStream]);

  useEffect(() => {
    if (!remote) setVideoLayoutSwapped(false);
  }, [remote]);

  /** Buton circular bară jos (WhatsApp-style). */
  const CircleBtn = ({
    onClick,
    title,
    active,
    danger,
    children,
  }: {
    onClick: () => void;
    title: string;
    active?: boolean;
    danger?: boolean;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 sm:h-[3.75rem] sm:w-[3.75rem] ${
        danger
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600"
          : active
            ? "bg-white text-zinc-900 shadow-lg hover:bg-white/90"
            : "bg-white/12 text-white backdrop-blur-md hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );

  if (callRejected) {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
          <p className="text-red-400 font-medium">Apel respins</p>
          <p className="text-night-500 text-sm">Celălalt utilizator a refuzat apelul. Redirecționare la mesaje…</p>
          <Link href="/app/messages" className="text-brand-400 hover:underline mt-2">
            Înapoi la mesaje
          </Link>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  if (status === "permission_help" && permissionHelp) {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 px-5 py-10 text-center bg-night-950">
          <div className="max-w-lg rounded-2xl border border-amber-500/40 bg-amber-500/[0.12] px-6 py-6 text-left shadow-lg shadow-amber-900/20">
            <p className="text-amber-200/80 text-xs font-medium uppercase tracking-wide mb-2">
              Ce înseamnă acest ecran
            </p>
            <p className="text-amber-50 font-semibold text-lg mb-4">{permissionHelp.headline}</p>
            <ul className="text-amber-100/90 text-sm space-y-3 list-disc pl-5 leading-relaxed">
              {permissionHelp.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="text-amber-200/70 text-xs mt-5 border-t border-amber-500/25 pt-4">
              În browser nu putem forța „doar casca telefonului” ca la apelul clasic — după ce permiți microfonul, vocea merge la ieșirea pe care o alege telefonul; dacă apare butonul „Difuzor”, îl poți folosi ca să comuți unde se aude.
            </p>
          </div>
          <button
            type="button"
            onClick={() => retryPermissions()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-night-900 font-semibold hover:bg-brand-400 transition active:scale-[0.98]"
          >
            <RefreshCw className="w-5 h-5" aria-hidden />
            Încearcă din nou (permite microfon / cameră)
          </button>
          <Link
            href="/app/messages"
            className="text-brand-400 hover:text-brand-300 font-medium hover:underline"
          >
            Înapoi la mesaje
          </Link>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  if (error) {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
          <p className="text-red-400 font-medium">{error}</p>
          <p className="text-night-500 text-sm max-w-md">
            Pe Vercel aceste valori sunt în Settings → Environment Variables; local pune-le în{" "}
            <code className="text-night-400">.env.local</code> (ex.{" "}
            <code className="text-night-400">npm run env:pull-production</code> după{" "}
            <code className="text-night-400">vercel link</code>). Vezi{" "}
            <code className="text-night-400">docs/calls.md</code>:{" "}
            <code className="text-night-400">NEXT_PUBLIC_SIGNALING_WS_URL</code>,{" "}
            <code className="text-night-400">NEXT_PUBLIC_TURN_URLS</code>,{" "}
            <code className="text-night-400">TURN_REALM</code>, <code className="text-night-400">TURN_STATIC_SECRET</code>,{" "}
            <code className="text-night-400">TURN_AUTH_SECRET</code>.
          </p>
          <Link href="/app/messages" className="text-brand-400 hover:underline mt-2">
            Înapoi la mesaje
          </Link>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  const chromeTopClass = chromeVisible
    ? "opacity-100 translate-y-0"
    : "opacity-0 -translate-y-3 pointer-events-none";
  const chromeBottomClass = chromeVisible
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-8 pointer-events-none";

  const pipFrameClass =
    "absolute z-30 overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-2 ring-white/20 " +
    "right-[max(0.75rem,env(safe-area-inset-right))] " +
    "bottom-[calc(7.25rem+env(safe-area-inset-bottom))] " +
    "w-[min(34vw,11rem)] sm:w-44 sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom))] md:w-52 aspect-video " +
    (canSwapVideoLayout ? "cursor-pointer touch-manipulation active:scale-[0.98] transition-transform" : "");

  /* ——— Apel video 1-la-1: fullscreen + PiP ——— */
  if (immersiveVideo) {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black text-white touch-manipulation"
          onPointerDown={onImmersivePointer}
          onPointerMove={onImmersivePointer}
        >
        <div className="absolute inset-0 overflow-hidden">
          {!videoLayoutSwapped ? (
            remote ? (
              <div
                role={canSwapVideoLayout ? "button" : undefined}
                tabIndex={canSwapVideoLayout ? 0 : undefined}
                className={`absolute inset-0 ${canSwapVideoLayout ? "cursor-pointer" : ""}`}
                onClick={canSwapVideoLayout ? toggleVideoLayout : undefined}
                onKeyDown={
                  canSwapVideoLayout
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleVideoLayout();
                        }
                      }
                    : undefined
                }
                aria-label={canSwapVideoLayout ? "Atinge pentru a te vedea mare în colț" : undefined}
              >
                <RemoteVideoStage participant={remote} />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
                <div className="h-16 w-16 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin mb-6" />
                <p className="text-white/60 text-sm">
                  {status === "connecting" ? "Se conectează…" : "Așteptăm celălalt participant…"}
                </p>
              </div>
            )
          ) : (
            <div
              role={canSwapVideoLayout ? "button" : undefined}
              tabIndex={canSwapVideoLayout ? 0 : undefined}
              className={`absolute inset-0 ${canSwapVideoLayout ? "cursor-pointer" : ""}`}
              onClick={canSwapVideoLayout ? toggleVideoLayout : undefined}
              onKeyDown={
                canSwapVideoLayout
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleVideoLayout();
                      }
                    }
                  : undefined
              }
              aria-label={canSwapVideoLayout ? "Atinge pentru a vedea din nou celălalt mare" : undefined}
            >
              {localStream && !videoMuted ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
                />
              ) : localStream && videoMuted ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-black to-zinc-950">
                  <div className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/15">
                    <VideoOff className="h-12 w-12 text-white/35" />
                  </div>
                  <p className="text-white/45 text-sm font-medium mt-4">Camera ta e oprită</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-all duration-300 ease-out ${chromeTopClass}`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300 ease-out ${chromeBottomClass}`}
        />

        <header
          className={`relative z-20 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 sm:px-4 transition-all duration-300 ease-out ${chromeTopClass}`}
        >
          <button
            type="button"
            onClick={handleLeave}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition"
            aria-label="Închide apelul"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="pointer-events-none flex flex-col items-center text-center px-2 min-w-0">
            <span className="font-semibold text-base sm:text-lg truncate max-w-[60vw]">
              {remote?.displayName || "Apel video"}
            </span>
            <span className="text-xs text-white/55 tabular-nums">
              {status === "connected" ? fmtCallDuration(elapsedSec) : status === "connecting" ? "Se conectează…" : ""}
            </span>
          </div>
          <div className="w-11 shrink-0" aria-hidden />
        </header>

        {banner ? (
          <div
            className={`relative z-20 mx-3 mt-1 rounded-xl bg-amber-500/20 border border-amber-400/35 px-3 py-2 text-xs text-amber-50 backdrop-blur-sm transition-all duration-300 ease-out ${chromeTopClass}`}
          >
            {banner}
          </div>
        ) : null}

        {/* PiP: implicit tu mic; după swap — celălalt mic. Atinge mare sau mic pentru a comuta. */}
        {!videoLayoutSwapped && localStream && !videoMuted && (
          <div
            className={pipFrameClass}
            onClick={canSwapVideoLayout ? toggleVideoLayout : undefined}
            role={canSwapVideoLayout ? "button" : undefined}
            tabIndex={canSwapVideoLayout ? 0 : undefined}
            aria-label={canSwapVideoLayout ? "Atinge pentru a te vedea mare pe ecran" : undefined}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover scale-x-[-1]"
            />
            <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] font-medium uppercase tracking-wider text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
              Tu
            </span>
          </div>
        )}
        {!videoLayoutSwapped && localStream && videoMuted && (
          <div
            className={`${pipFrameClass} flex items-center justify-center bg-zinc-800/95 ring-white/15`}
            onClick={canSwapVideoLayout ? toggleVideoLayout : undefined}
            role={canSwapVideoLayout ? "button" : undefined}
            aria-label={canSwapVideoLayout ? "Atinge pentru a te vedea mare pe ecran" : undefined}
          >
            <VideoOff className="h-8 w-8 text-white/35" />
          </div>
        )}
        {videoLayoutSwapped && remote && (
          <div
            className={pipFrameClass}
            onClick={canSwapVideoLayout ? toggleVideoLayout : undefined}
            role={canSwapVideoLayout ? "button" : undefined}
            tabIndex={canSwapVideoLayout ? 0 : undefined}
            aria-label={canSwapVideoLayout ? "Atinge pentru a vedea din nou celălalt mare" : undefined}
          >
            <div className="relative h-full w-full">
              <RemoteVideoStage participant={remote} />
            </div>
            <span className="pointer-events-none absolute bottom-1.5 left-2 right-2 truncate text-[10px] font-medium uppercase tracking-wider text-white/80 bg-black/50 px-1.5 py-0.5 rounded max-w-[calc(100%-0.5rem)]">
              {remote.displayName || "Participant"}
            </span>
          </div>
        )}
        <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />

        {chromeVisible && status === "connected" ? (
          <p
            className={`relative z-20 mx-auto -mb-1 max-w-sm px-4 text-center text-[10px] leading-snug text-white/45 transition-all duration-300 ${chromeBottomClass}`}
          >
            {isMobileUi ? (
              <>
                Pe telefon, sunetul îl alege browserul (uneori difuzor, uneori cască).{" "}
                {showSpeakerToggle
                  ? "„Difuzor” forțează ieșirea tare când e suportat."
                  : "„Discret” oprește sunetul la amândoi la tine (inclusiv microfonul)."}
              </>
            ) : (
              <>
                Pe laptop/PC, sunetul merge la boxe/căști după sistem. „Discret” = fără voce la amândoi la tine
                (inclusiv oprește microfonul ca să nu audă foșnet).
              </>
            )}
          </p>
        ) : null}

        <div
          className={`relative z-20 mt-auto flex flex-wrap items-center justify-center gap-3 sm:gap-5 px-3
            pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 transition-all duration-300 ease-out ${chromeBottomClass}`}
        >
          <CircleBtn
            onClick={onMicToggle}
            title={
              privacyQuietMode
                ? "Mod discret activ — apasă pentru sunet + microfon normal"
                : muted
                  ? "Pornește microfonul"
                  : "Dezactivează microfonul"
            }
            active={!muted}
          >
            {muted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          <CircleBtn
            onClick={() => setVideoMuted(!videoMuted)}
            title={videoMuted ? "Pornește camera" : "Oprește camera"}
            active={!videoMuted}
          >
            {videoMuted ? <VideoOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Video className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          {showCameraFlip && (
            <CircleBtn
              onClick={() => void switchCamera()}
              title="Față / spate — comută camera"
            >
              <RefreshCw className="h-6 w-6 sm:h-7 sm:w-7" />
            </CircleBtn>
          )}
          {screenshareAllowed && (
            <CircleBtn
              onClick={() => void toggleScreenShare()}
              title={screenSharing ? "Oprește ecranul" : "Partajare ecran"}
              active={screenSharing}
            >
              <MonitorUp className="h-6 w-6 sm:h-7 sm:w-7" />
            </CircleBtn>
          )}
          {showSpeakerToggle ? (
            <CircleBtn
              onClick={() => setSpeakerOutputOn((v) => !v)}
              title={speakerOutputOn ? "Revino la ieșirea implicită (telefon)" : "Difuzor"}
              active={speakerOutputOn}
            >
              {speakerOutputOn ? (
                <Volume2 className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : (
                <Smartphone className="h-6 w-6 sm:h-7 sm:w-7" />
              )}
            </CircleBtn>
          ) : null}
          <CircleBtn
            onClick={togglePrivacyQuietMode}
            title={
              privacyQuietMode
                ? "Ieși din mod discret (sunet + microfon ca înainte)"
                : "Mod discret: nu auzi celălalt și nici el pe tine (microfon oprit, fără foșnet)"
            }
            danger={privacyQuietMode}
            active={!privacyQuietMode}
          >
            {privacyQuietMode ? (
              <VolumeX className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : (
              <Headphones className="h-6 w-6 sm:h-7 sm:w-7" />
            )}
          </CircleBtn>
          <CircleBtn onClick={handleLeave} title="Închide apelul" danger>
            <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
          </CircleBtn>
        </div>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  /* ——— Apel audio 1-la-1: ecran dedicat, fără casete video mici ——— */
  if (immersiveAudio) {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-zinc-900 via-black to-zinc-950 text-white touch-manipulation"
          onPointerDown={onImmersivePointer}
          onPointerMove={onImmersivePointer}
        >
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent transition-all duration-300 ease-out ${chromeTopClass}`}
        />
        <header
          className={`relative z-10 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 transition-all duration-300 ease-out ${chromeTopClass}`}
        >
          <button
            type="button"
            onClick={handleLeave}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
            aria-label="Înapoi"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="text-center min-w-0 px-2">
            <p className="font-semibold text-lg truncate">{remote?.displayName || "Apel audio"}</p>
            <p className="text-xs text-white/50 tabular-nums">
              {status === "connected" ? fmtCallDuration(elapsedSec) : "Se conectează…"}
            </p>
          </div>
          <div className="w-11" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 -mt-8">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-3xl scale-150" />
            <div className="relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 ring-2 ring-white/20 shadow-2xl">
              <span className="text-5xl sm:text-6xl font-light text-white/90">
                {(remote?.displayName || displayName || "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
          </div>
          <p className="text-white/40 text-sm">Apel vocal securizat</p>
          {remote?.stream ? <RemoteAudio stream={remote.stream} /> : null}
        </div>

        <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />

        {banner ? (
          <div
            className={`mx-4 mb-2 rounded-xl bg-amber-500/20 border border-amber-400/35 px-3 py-2 text-xs text-amber-50 transition-all duration-300 ease-out ${chromeBottomClass}`}
          >
            {banner}
          </div>
        ) : null}

        {chromeVisible && status === "connected" ? (
          <p
            className={`mx-auto mb-1 max-w-sm px-4 text-center text-[10px] leading-snug text-white/45 transition-all duration-300 ${chromeBottomClass}`}
          >
            {isMobileUi ? (
              <>
                Sunetul îl alege telefonul/browserul.{" "}
                {showSpeakerToggle ? "„Difuzor” = mai tare când merge." : ""}{" "}
                „Discret” = fără sunet la amândoi la tine (și microfon oprit).
              </>
            ) : (
              <>
                Pe PC: sunet la boxe/căști după Windows. „Discret” = nu auzi + nu te aud (fără foșnet).
              </>
            )}
          </p>
        ) : null}

        <div
          className={`flex flex-wrap items-center justify-center gap-3 sm:gap-5 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 transition-all duration-300 ease-out ${chromeBottomClass}`}
        >
          <CircleBtn
            onClick={onMicToggle}
            title={
              privacyQuietMode
                ? "Mod discret — apasă pentru normal"
                : muted
                  ? "Pornește microfonul"
                  : "Mute"
            }
            active={!muted}
          >
            {muted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          {showSpeakerToggle ? (
            <CircleBtn
              onClick={() => setSpeakerOutputOn((v) => !v)}
              title={speakerOutputOn ? "Ieșire implicită (telefon)" : "Difuzor"}
              active={speakerOutputOn}
            >
              {speakerOutputOn ? (
                <Volume2 className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : (
                <Smartphone className="h-6 w-6 sm:h-7 sm:w-7" />
              )}
            </CircleBtn>
          ) : null}
          <CircleBtn
            onClick={togglePrivacyQuietMode}
            title={
              privacyQuietMode
                ? "Ieși din mod discret"
                : "Mod discret: fără sunet la amândoi la tine (microfon oprit)"
            }
            danger={privacyQuietMode}
            active={!privacyQuietMode}
          >
            {privacyQuietMode ? (
              <VolumeX className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : (
              <Headphones className="h-6 w-6 sm:h-7 sm:w-7" />
            )}
          </CircleBtn>
          <CircleBtn onClick={handleLeave} title="Închide" danger>
            <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
          </CircleBtn>
        </div>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  /* ——— Conferință sau fallback ——— */
  return (
    <RemotePlaybackContext.Provider value={remotePlayback}>
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between border-b border-night-600 py-2 px-3 sm:px-4">
        <Link href="/app/messages" onClick={() => leave()} className="text-night-500 hover:text-white text-sm">
          ← Mesaje
        </Link>
        <span className="text-night-500 text-sm">
          {status === "connecting" && "Se conectează…"}
          {status === "connected" && (isConference ? "Conferință" : "Apel")}
          {status === "left" && "Apel încheiat"}
        </span>
        {isConference && status === "connected" && (
          <button
            type="button"
            onClick={() => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/app/call/${roomId}` : "";
              navigator.clipboard
                ?.writeText(url)
                .then(() => alert("Link copiat!"))
                .catch(() => {});
            }}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            Invită
          </button>
        )}
        {!isConference && <span className="w-16" />}
      </div>

      {banner ? (
        <div className="mx-4 mt-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-sm text-amber-100">
          {banner}
        </div>
      ) : null}

      <div
        className={`grid flex-1 min-h-0 gap-3 p-3 sm:p-4 overflow-auto ${
          isConference ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 max-w-3xl mx-auto w-full"
        }`}
      >
        <div className="relative rounded-2xl overflow-hidden bg-night-800 border border-white/10 aspect-video shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />
          <span className="absolute bottom-2 left-2 text-xs bg-black/55 backdrop-blur-sm px-2 py-1 rounded-lg">Tu</span>
        </div>

        {remoteParticipants.map((p) => (
          <RemoteVideoCard key={p.id} participant={p} />
        ))}

        {status === "connected" && remoteParticipants.length === 0 && (
          <div className="flex items-center justify-center text-night-500 col-span-full min-h-[12rem]">
            Așteptăm participanți…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 border-t border-night-600 bg-night-950/90 py-3 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onMicToggle}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
            muted ? "bg-red-500/25 text-red-300" : "bg-night-600 text-white hover:bg-night-500"
          }`}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {privacyQuietMode ? "Discret (mic)" : muted ? "Pornește mic." : "Mute"}
        </button>
        {!audioOnly && (
          <button
            type="button"
            onClick={() => setVideoMuted(!videoMuted)}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              videoMuted ? "bg-red-500/25 text-red-300" : "bg-night-600 text-white hover:bg-night-500"
            }`}
          >
            {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            {videoMuted ? "Pornește video" : "Oprește video"}
          </button>
        )}
        {showCameraFlip && (
          <button
            type="button"
            onClick={() => void switchCamera()}
            title="Față / spate — comută camera"
            className="flex items-center gap-2 rounded-full bg-night-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-500"
          >
            <RefreshCw className="w-5 h-5" />
            Față / spate
          </button>
        )}
        {!audioOnly && screenshareAllowed && (
          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              screenSharing ? "bg-amber-500/25 text-amber-300" : "bg-night-600 text-white hover:bg-night-500"
            }`}
          >
            <MonitorUp className="w-5 h-5" />
            Ecran
          </button>
        )}
        {showSpeakerToggle ? (
          <button
            type="button"
            onClick={() => setSpeakerOutputOn((v) => !v)}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              speakerOutputOn ? "bg-brand-500/25 text-brand-200" : "bg-night-600 text-white hover:bg-night-500"
            }`}
            title={speakerOutputOn ? "Ieșire implicită" : "Difuzor"}
          >
            {speakerOutputOn ? <Volume2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            {speakerOutputOn ? "Difuzor" : "Telefon"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={togglePrivacyQuietMode}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
            privacyQuietMode ? "bg-amber-500/25 text-amber-200" : "bg-night-600 text-white hover:bg-night-500"
          }`}
          title={
            privacyQuietMode
              ? "Ieși din mod discret (sunet + microfon ca înainte)"
              : "Mod discret: nu auzi pe ceilalți și nu te aud (mic oprit)"
          }
        >
          {privacyQuietMode ? <VolumeX className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
          {privacyQuietMode ? "Normal" : "Discret"}
        </button>
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center gap-2 rounded-full bg-red-500/25 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/35"
        >
          <PhoneOff className="w-5 h-5" />
          Închide
        </button>
      </div>
    </div>
    </RemotePlaybackContext.Provider>
  );
}
