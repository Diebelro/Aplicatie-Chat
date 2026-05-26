"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type RefObject,
  type Ref,
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
  EarOff,
  AlertCircle,
  ServerCog,
  UserRound,
  UserRoundX,
} from "lucide-react";
import {
  useWebRtcCall,
  type RemoteParticipant,
  type CallConnectionPhase,
} from "@/hooks/useWebRtcCall";
import type { CallUiPhase } from "@/lib/call/callUiPhase";
import { getAuthHeaders } from "@/lib/authClient";
import { isScreenshareFeatureEnabled } from "@/lib/env/webrtcConfig";
import {
  DEFAULT_AUDIO_SINK,
  applyAudioSinkId,
  listAudioOutputDevices,
  pickSpeakerLikeSinkId,
  supportsAudioOutputSelection,
} from "@/lib/webrtc/audioOutput";
import { isMobileDevice } from "@/lib/webrtc/mediaConstraints";
import { useCallRoomTranslate } from "@/lib/i18n/callTranslateSafe";
import { callErrorRawForHints, resolveCallDisplayedError } from "@/lib/i18n/callApiErrorMap";
import {
  attachCursorReceiver,
  attachCursorSender,
  setCursorEnabled,
} from "@/lib/webrtc/cursorOverlay";
import { markCallEndPosted, shouldSkipDuplicateCallEnd } from "@/lib/callEndDedup";
import { markIncomingGrace, POST_HANGUP_INCOMING_GRACE_MS } from "@/lib/callIncomingGrace";
import { stopIncomingRingtone } from "@/lib/callRingtone";
import { useVideoRenderable } from "@/hooks/useVideoRenderable";
import { useOutgoingCallerPoll } from "@/hooks/useOutgoingCallerPoll";
import { DiebelWordmark } from "@/components/DiebelWordmark";
import { emit } from "@/lib/telemetry/callTelemetry";

/** Ieșire audio pentru stream-ul remot + opțiune „nu aud pe aici” (confidențialitate). */
type RemoteAudioPlayback = {
  sinkId: string;
  /** true = volum 0 pe vocea celuilalt; microfonul tău nu e afectat */
  remoteMuted: boolean;
  /** Incrementat după gest utilizator când browserul blochează redarea automată a audio-ului remot. */
  playbackUnlockKey: number;
  onRemotePlayBlocked?: () => void;
};

const defaultRemotePlayback: RemoteAudioPlayback = {
  sinkId: DEFAULT_AUDIO_SINK,
  remoteMuted: false,
  playbackUnlockKey: 0,
  onRemotePlayBlocked: undefined,
};

const RemotePlaybackContext = createContext<RemoteAudioPlayback>(defaultRemotePlayback);

function fmtCallDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const { sinkId, remoteMuted, playbackUnlockKey, onRemotePlayBlocked } = useContext(RemotePlaybackContext);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const flush = () => {
      el.srcObject = stream;
      el.volume = remoteMuted ? 0 : 1;
      void applyAudioSinkId(el, sinkId);
      const p = el.play();
      if (p !== undefined && typeof (p as Promise<void>).catch === "function") {
        void (p as Promise<void>).catch(() => {
          onRemotePlayBlocked?.();
        });
      }
    };
    flush();
    stream.addEventListener("addtrack", flush);
    stream.addEventListener("removetrack", flush);
    return () => {
      stream.removeEventListener("addtrack", flush);
      stream.removeEventListener("removetrack", flush);
      el.srcObject = null;
    };
  }, [stream, sinkId, remoteMuted, playbackUnlockKey, onRemotePlayBlocked]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

function useRemoteVideoElement(ref: RefObject<HTMLVideoElement | null>, stream: MediaStream | null | undefined) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!stream) {
      if (el.srcObject != null) el.srcObject = null;
      return;
    }

    const tryPlay = () => {
      void el.play().catch(() => {
        /* autoplay / gesture — iOS/Safari: video muted + playsInline pe element; fără schimbare comportament aici */
      });
    };
    const attachStream = () => {
      el.srcObject = stream;
      tryPlay();
    };
    attachStream();
    const bindTrackListeners = () => {
      const vtracks = stream.getVideoTracks();
      for (const t of vtracks) {
        t.addEventListener("unmute", tryPlay);
        t.addEventListener("mute", tryPlay);
        t.addEventListener("ended", tryPlay);
      }
      return vtracks;
    };
    let vtracks = bindTrackListeners();
    const onStreamTracksChanged = () => {
      const next = stream.getVideoTracks();
      for (const t of next) {
        if (!vtracks.includes(t)) {
          t.addEventListener("unmute", tryPlay);
          t.addEventListener("mute", tryPlay);
          t.addEventListener("ended", tryPlay);
        }
      }
      for (const t of vtracks) {
        if (!next.includes(t)) {
          t.removeEventListener("unmute", tryPlay);
          t.removeEventListener("mute", tryPlay);
          t.removeEventListener("ended", tryPlay);
        }
      }
      vtracks = next;
      /* Chrome/Android poate să nu pornească randarea când video track apare după audio în același MediaStream. */
      el.srcObject = null;
      requestAnimationFrame(attachStream);
    };
    stream.addEventListener("addtrack", onStreamTracksChanged);
    stream.addEventListener("removetrack", onStreamTracksChanged);
    return () => {
      stream.removeEventListener("addtrack", onStreamTracksChanged);
      stream.removeEventListener("removetrack", onStreamTracksChanged);
      for (const t of vtracks) {
        t.removeEventListener("unmute", tryPlay);
        t.removeEventListener("mute", tryPlay);
        t.removeEventListener("ended", tryPlay);
      }
      el.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref e RefObject stabil; depindem doar de stream
  }, [stream]);
}

/**
 * Pe ecran lat: `object-contain` arată tot cadrul dar imaginea e îngustă (pillarbox). Mic `scale` în
 * container `overflow-hidden` umple mai mult ecranul fără tăierea agresivă a lui `object-cover` pur.
 * Pe telefon: `object-cover` fără zoom suplimentar.
 *
 * Preview local fără oglindire — aceeași orientare ca stream-ul trimis.
 */
function callVideoFramingClasses(): { fit: string; zoom: string } {
  if (isMobileDevice()) {
    return { fit: "object-cover", zoom: "" };
  }
  return {
    fit: "object-contain object-center",
    /* Încercare mai agresivă pe lat — aproape de cover dar plecând de la contain. */
    zoom: "scale-[1.82] origin-center will-change-transform",
  };
}

/** Card mic (conferință / layout clasic). */
function RemoteVideoCard({ participant }: { participant: RemoteParticipant }) {
  const { tStr } = useCallRoomTranslate();
  const ref = useRef<HTMLVideoElement>(null);
  const stream = participant.stream ?? null;
  useRemoteVideoElement(ref, stream);
  const hasRenderableVideo = useVideoRenderable(ref, stream);
  const { fit: remoteFit, zoom: remoteZoom } = callVideoFramingClasses();

  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-black border border-white/10 aspect-video shadow-xl">
      {stream ? (
        <>
          <video
            ref={ref}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full ${remoteFit} ${remoteZoom} transition-opacity duration-500 ease-out ${
              hasRenderableVideo ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-black transition-opacity duration-300 ease-out pointer-events-none ${
              hasRenderableVideo ? "opacity-0" : "opacity-100"
            }`}
            aria-hidden={hasRenderableVideo}
          >
            <span className="text-3xl font-semibold text-white/40">
              {(participant.displayName || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="text-xs text-night-400 mt-2">{tStr("pages.callRoom.ui.noVideo")}</span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-night-400 gap-2">
          <span className="text-3xl font-semibold text-white/40">
            {(participant.displayName || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="text-xs">{tStr("pages.callRoom.ui.noVideo")}</span>
        </div>
      )}
      {stream?.getAudioTracks().length ? <RemoteAudio stream={stream} /> : null}
      <span className="absolute bottom-2 left-2 z-20 text-xs bg-black/55 backdrop-blur-sm px-2 py-1 rounded-lg truncate max-w-[85%]">
        {participant.displayName || participant.id}
      </span>
    </div>
  );
}

/** Remote pe tot ecranul (apel 1-la-1 video). */
function RemoteVideoStage({
  participant,
  overlayHostRef,
}: {
  participant: RemoteParticipant;
  overlayHostRef?: Ref<HTMLDivElement>;
}) {
  const { tStr } = useCallRoomTranslate();
  const ref = useRef<HTMLVideoElement>(null);
  const stream = participant.stream ?? null;
  useRemoteVideoElement(ref, stream);
  const hasRenderableVideo = useVideoRenderable(ref, stream);
  const { fit: remoteFit, zoom: remoteZoom } = callVideoFramingClasses();

  return (
    <div
      id="remoteShareWrapper"
      ref={overlayHostRef}
      className="absolute inset-0 isolate h-full w-full overflow-hidden bg-black"
    >
      {stream ? (
        <>
          <video
            id="remoteShareVideo"
            ref={ref}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full ${remoteFit} ${remoteZoom} transition-opacity duration-500 ease-out ${
              hasRenderableVideo ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-black transition-opacity duration-300 ease-out pointer-events-none ${
              hasRenderableVideo ? "opacity-0" : "opacity-100"
            }`}
            aria-hidden={hasRenderableVideo}
          >
            <div className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center text-4xl font-light text-white/50 mb-4 ring-2 ring-white/15">
              {(participant.displayName || "?").slice(0, 1).toUpperCase()}
            </div>
            <p className="text-white/45 text-sm font-medium tracking-wide">
              {tStr("pages.callRoom.ui.noVideoFromPeer")}
            </p>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
          <div className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center text-4xl font-light text-white/50 mb-4 ring-2 ring-white/15">
            {(participant.displayName || "?").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-white/45 text-sm font-medium tracking-wide">{tStr("pages.callRoom.ui.noVideoFromPeer")}</p>
        </div>
      )}
      {stream?.getAudioTracks().length ? <RemoteAudio stream={stream} /> : null}
    </div>
  );
}

/**
 * Ascunde doar video-ul interlocutorului (păstrează audio). Util când vrei ecran curat sau doar imaginea ta.
 */
function RemoteVideoStageOptional({
  participant,
  overlayHostRef,
  videoVisible,
  variant = "fullscreen",
}: {
  participant: RemoteParticipant;
  overlayHostRef?: Ref<HTMLDivElement>;
  videoVisible: boolean;
  variant?: "fullscreen" | "pip";
}) {
  const { tStr } = useCallRoomTranslate();
  const stream = participant.stream ?? null;
  if (videoVisible || !stream) {
    return <RemoteVideoStage participant={participant} overlayHostRef={overlayHostRef} />;
  }
  const pip = variant === "pip";
  return (
    <div
      id="remoteShareWrapper"
      ref={overlayHostRef}
      className={
        pip
          ? "absolute inset-0 isolate h-full w-full bg-zinc-950 flex flex-col items-center justify-center"
          : "absolute inset-0 isolate h-full w-full bg-black flex flex-col items-center justify-center"
      }
    >
      {pip ? (
        <UserRoundX className="h-9 w-9 text-white/35 shrink-0" aria-hidden />
      ) : (
        <>
          <div className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center text-4xl font-light text-white/50 mb-4 ring-2 ring-white/15">
            {(participant.displayName || "?").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-white/45 text-sm font-medium px-6 text-center leading-snug">
            {tStr("pages.callRoom.ui.remoteVideoHiddenHint")}
          </p>
        </>
      )}
      {stream.getAudioTracks().length ? <RemoteAudio stream={stream} /> : null}
    </div>
  );
}

const MINI_PREVIEW_STORAGE_KEY = "diebel.call.showMiniPreview";
/** După conectare, ascundem bara de controale ca să nu stea peste imagine; tap / mișcare mouse reafișează. */
/** Mai lung = mai puțin „intră/iese” bara de controale la fiecare mișcare pe video. */
const CHROME_AUTO_HIDE_MS = 8000;

/** Mod discret: fără căști (se confundă cu difuzor); Volume2 = sunet activ, EarOff = lângă butonul Difuzor fără dublură. */
function PrivacyQuietIcon({
  active,
  showSpeakerToggle,
  className,
}: {
  active: boolean;
  showSpeakerToggle: boolean;
  className: string;
}) {
  if (active) return <VolumeX className={className} />;
  if (showSpeakerToggle) return <EarOff className={className} />;
  return <Volume2 className={className} />;
}

/** Banner + indicii reconectare (fără blur); aria-live pe container. */
function ReconnectHintPanel({
  active,
  iceRecoveryInFlight,
  long1,
  long2,
  ui,
  className,
  bannerClassName,
}: {
  active: boolean;
  iceRecoveryInFlight: boolean;
  long1: boolean;
  long2: boolean;
  ui: (id: string) => string;
  className: string;
  bannerClassName: string;
}) {
  if (!active) return null;
  return (
    <div role="status" aria-live="polite" className={className}>
      {iceRecoveryInFlight ? <div className={bannerClassName}>{ui("reconnectingBanner")}</div> : null}
      {long1 || long2 ? (
        <div className="mt-1.5 space-y-1 px-0.5">
          {long1 ? (
            <p className="text-[11px] leading-snug text-sky-100/90">{ui("reconnectingLong1")}</p>
          ) : null}
          {long2 ? (
            <p className="text-[11px] leading-snug text-sky-100/85">{ui("reconnectingLong2")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type CallUIProps = {
  roomId: string;
  userId: string;
  displayName: string;
  audioOnly: boolean;
  isConference: boolean;
  isCaller?: boolean;
  /** Afișat o dată după sunare (ex. limitări push), fără să blocheze navigarea. */
  transientRingNotify?: string | null;
};

export default function CallUI({
  roomId,
  userId,
  displayName,
  audioOnly,
  isConference,
  isCaller: isCallerProp,
  transientRingNotify = null,
}: CallUIProps) {
  const callTranslate = useCallRoomTranslate();
  const router = useRouter();

  const ui = useCallback(
    (id: string) => callTranslate.tStr(`pages.callRoom.ui.${id}`),
    [callTranslate]
  );
  const getP2pConnectingSubtitle = useCallback(
    (
      audioOnlyCall: boolean,
      phase: CallConnectionPhase | null,
      waitingPeer: boolean,
      isConnectingPrep: boolean
    ): string => {
      switch (phase) {
        case "signaling_connecting":
          return ui("phaseSignalingConnecting");
        case "signaling_connected":
          return ui("phaseSignalingConnected");
        case "negotiating":
          return audioOnlyCall ? ui("phaseNegotiatingAudio") : ui("phaseNegotiatingVideo");
        case "peer_joined":
          return ui("phasePeerJoined");
        case "waiting_peer":
          return ui("phaseWaitingPeer");
        default:
          break;
      }
      if (waitingPeer) return ui("phaseWaitingPeer");
      if (isConnectingPrep) {
        return audioOnlyCall ? ui("phasePrepMic") : ui("phasePrepCamMic");
      }
      return ui("phaseConnectingGeneric");
    },
    [ui]
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  /** false = celălalt pe tot ecranul, tu în colț; true = invers */
  const [videoLayoutSwapped, setVideoLayoutSwapped] = useState(false);
  /** Apel 1-la-1 video: mini-preview (PiP); doar UI — camera rămâne activă. */
  const [showMiniPreview, setShowMiniPreview] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(MINI_PREVIEW_STORAGE_KEY);
      if (raw === "false") return false;
      if (raw === "true") return true;
    } catch {
      /* ignore */
    }
    return true;
  });
  /** Afișează sau ascunde video-ul interlocutorului (audio rămâne). */
  const [showRemoteParticipantVideo, setShowRemoteParticipantVideo] = useState(true);
  const isCaller = !!isCallerProp && !isConference;

  const screenshareAllowed = isScreenshareFeatureEnabled();

  const {
    callState,
    error,
    permissionHelp,
    remoteParticipants,
    muted,
    setMuted,
    videoMuted,
    setVideoMuted,
    cameraSoftFailed,
    leave,
    localStream,
    banner,
    canSwitchCamera,
    screenSharing,
    switchCamera,
    toggleScreenShare,
    retryPermissions,
    waitingForPeerInRoom,
    connectionPhase,
    callUiPhase,
    iceRecoveryInFlight,
    cursorDataChannel,
  } = useWebRtcCall({
    roomId,
    userId,
    displayName,
    audioOnly,
    isCaller,
    isConference,
    callTranslate,
    onAutoEnded: () => {
      markCallEndPosted(roomId);
      markIncomingGrace(roomId, undefined, POST_HANGUP_INCOMING_GRACE_MS);
      void fetch("/api/call/end", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ roomId }),
      }).catch(() => {});
      router.replace("/app/messages");
    },
  });

  const errorBackMessagesRef = useRef<HTMLAnchorElement | null>(null);

  useLayoutEffect(() => {
    if (!error) return;
    const id = window.requestAnimationFrame(() => {
      errorBackMessagesRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [error]);

  const prevCallUiPhaseRef = useRef(callUiPhase);
  useEffect(() => {
    const prev = prevCallUiPhaseRef.current;
    const next = callUiPhase;
    if (prev !== "reconnecting" && next === "reconnecting") emit("CALL_RECONNECTING_START");
    if (prev === "reconnecting" && next !== "reconnecting") emit("CALL_RECONNECTING_END");
    if (prev !== "failed" && next === "failed") emit("CALL_FAILED");
    prevCallUiPhaseRef.current = next;
  }, [callUiPhase]);

  const [reconnectStartedAt, setReconnectStartedAt] = useState<number | null>(null);
  const [, setReconnectTick] = useState(0);

  useEffect(() => {
    if (callUiPhase === "reconnecting") {
      setReconnectStartedAt((t) => (t == null ? Date.now() : t));
      const id = window.setInterval(() => setReconnectTick((n) => n + 1), 1000);
      return () => window.clearInterval(id);
    }
    setReconnectStartedAt(null);
    setReconnectTick(0);
  }, [callUiPhase]);

  const reconnectElapsedMs =
    callUiPhase === "reconnecting" && reconnectStartedAt != null ? Date.now() - reconnectStartedAt : 0;

  const showReconnectLong1 = callUiPhase === "reconnecting" && reconnectElapsedMs >= 8000;
  const showReconnectLong2 = callUiPhase === "reconnecting" && reconnectElapsedMs >= 20000;
  const reconnectPanelActive = iceRecoveryInFlight || showReconnectLong1 || showReconnectLong2;

  const outgoingTerminal = useOutgoingCallerPoll({
    roomId,
    isCaller,
    callConnected: callState === "connected",
    remoteParticipantCount: remoteParticipants.length,
  });

  const isConnectingLike: boolean =
    callState === "connecting" ||
    callState === "outgoing" ||
    callState === "incoming" ||
    callState === "reconnecting";

  /** Linie status header (P2P imersiv video/audio): include reconectare. */
  const p2pImmersiveHeaderStatusText = useMemo(() => {
    if (callState === "connected") return fmtCallDuration(elapsedSec);
    return "";
  }, [
    callState,
    elapsedSec,
  ]);

  /** Pe telefon comutăm față/spate prin facingMode chiar dacă enumerateDevices raportează un singur videoinput. */
  const showCameraFlip = !audioOnly && (canSwitchCamera || isMobileDevice());

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  /** Ref callback: la fiecare montare/demontare a `<video>` local, legăm imediat `srcObject` (useEffect singur ratează cicluri oprit/pornit cameră / PiP). */
  const bindLocalVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      const prev = localVideoRef.current;
      if (prev && prev !== node) {
        try {
          prev.srcObject = null;
        } catch {
          /* ignore */
        }
      }
      localVideoRef.current = node;
      if (node) {
        node.srcObject = localStream ?? null;
      }
    },
    [localStream]
  );
  const bindLocalAudioRef = useCallback(
    (node: HTMLAudioElement | null) => {
      const prev = localAudioRef.current;
      if (prev && prev !== node) {
        try {
          prev.srcObject = null;
        } catch {
          /* ignore */
        }
      }
      localAudioRef.current = node;
      if (node) {
        node.srcObject = localStream ?? null;
      }
    },
    [localStream]
  );
  useLayoutEffect(() => {
    const v = localVideoRef.current;
    if (v) v.srcObject = localStream ?? null;
    const a = localAudioRef.current;
    if (a) a.srcObject = localStream ?? null;
  }, [localStream]);
  /** Partajare ecran: trimitere cursor normalizat (P2P DataChannel). */
  const localCursorSendRef = useRef<HTMLDivElement>(null);
  /** Suprapunere cursor primit peste video-ul celuilalt. */
  const remoteCursorOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MINI_PREVIEW_STORAGE_KEY, showMiniPreview ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [showMiniPreview]);

  useEffect(() => {
    if (callState !== "connected") {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [callState]);

  const [chromeVisible, setChromeVisible] = useState(true);
  /** În browser setTimeout returnează number; evită conflict cu tipul Node `Timeout`. */
  const chromeHideTimerRef = useRef<number | null>(null);
  const lastMoveBumpRef = useRef(0);
  /** Autoplay: redarea audio-ului remot poate necesita un al doilea gest după ce microfonul e deja activ. */
  const [remotePlaybackBlockedHint, setRemotePlaybackBlockedHint] = useState(false);
  const [playbackUnlockKey, setPlaybackUnlockKey] = useState(0);
  const [leavingCall, setLeavingCall] = useState(false);
  const leavingCallRef = useRef(false);

  const scheduleChromeHide = useCallback(() => {
    if (chromeHideTimerRef.current) {
      clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
    }
    setChromeVisible(true);
    if (callState !== "connected") return;
    chromeHideTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
      chromeHideTimerRef.current = null;
    }, CHROME_AUTO_HIDE_MS);
  }, [callState]);

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
      if (remotePlaybackBlockedHint) {
        setRemotePlaybackBlockedHint(false);
        setPlaybackUnlockKey((k) => k + 1);
      }
      /** Pe touch/pen: nu reseta timerul la fiecare glisare pe video — altfel bara „pulsează” haotic. */
      if (e.type === "pointermove" && (e.pointerType === "touch" || e.pointerType === "pen")) {
        return;
      }
      if (e.type === "pointermove" && e.pointerType === "mouse") {
        const now = Date.now();
        if (now - lastMoveBumpRef.current < 450) return;
        lastMoveBumpRef.current = now;
      }
      scheduleChromeHide();
    },
    [scheduleChromeHide, remotePlaybackBlockedHint]
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
    if (callState === "connected") return;
    if (!privacyQuietMode) return;
    exitPrivacyQuietMode();
  }, [callState, privacyQuietMode, exitPrivacyQuietMode]);

  useEffect(() => {
    if (!supportsAudioOutputSelection()) return;
    void listAudioOutputDevices().then((devs) => {
      setSpeakerSinkIdResolved(pickSpeakerLikeSinkId(devs));
    });
  }, [callState]);

  const remoteAudioSinkId = useMemo(() => {
    if (!supportsAudioOutputSelection()) return DEFAULT_AUDIO_SINK;
    if (speakerOutputOn && speakerSinkIdResolved) return speakerSinkIdResolved;
    return DEFAULT_AUDIO_SINK;
  }, [speakerOutputOn, speakerSinkIdResolved]);

  const reportRemotePlayBlocked = useCallback(() => {
    setRemotePlaybackBlockedHint(true);
  }, []);

  const remotePlayback = useMemo(
    () => ({
      sinkId: remoteAudioSinkId,
      remoteMuted: privacyQuietMode,
      playbackUnlockKey,
      onRemotePlayBlocked: reportRemotePlayBlocked,
    }),
    [remoteAudioSinkId, privacyQuietMode, playbackUnlockKey, reportRemotePlayBlocked]
  );

  useEffect(() => {
    stopIncomingRingtone();
  }, [roomId, callState]);

  useEffect(() => {
    if (!remotePlaybackBlockedHint) return;
    const unlock = () => {
      setRemotePlaybackBlockedHint(false);
      setPlaybackUnlockKey((k) => k + 1);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [remotePlaybackBlockedHint]);

  /** Doar pe mobil: pe desktop lăsăm ieșirea implicită (boxe/căști după OS). */
  const showSpeakerToggle = isMobileUi && supportsAudioOutputSelection() && !!speakerSinkIdResolved;

  useEffect(() => {
    if (!outgoingTerminal) return;
    const t = setTimeout(() => router.replace("/app/messages"), 1800);
    return () => clearTimeout(t);
  }, [outgoingTerminal, router]);

  /**
   * „Respins” e terminal: mai întâi oprim media/WebRTC, apoi cleanup server (fără dublare POST /end).
   * Nu facem asta la „unreachable” — acolo există recuperare dacă WebRTC se leagă după poll.
   */
  useEffect(() => {
    if (outgoingTerminal !== "rejected" || !isCaller) return;
    leave();
    if (shouldSkipDuplicateCallEnd(roomId)) return;
    markCallEndPosted(roomId);
    markIncomingGrace(roomId, undefined, POST_HANGUP_INCOMING_GRACE_MS);
    void fetch("/api/call/end", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ roomId }),
    }).catch(() => {});
  }, [outgoingTerminal, isCaller, leave, roomId]);

  const handleLeave = () => {
    if (leavingCallRef.current) return;
    leavingCallRef.current = true;
    setLeavingCall(true);
    stopIncomingRingtone();
    markCallEndPosted(roomId);
    markIncomingGrace(roomId, undefined, POST_HANGUP_INCOMING_GRACE_MS);
    leave();
    void fetch("/api/call/end", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        roomId,
        ...(isCaller && callState !== "connected" ? { recordMissedForCallee: true } : {}),
      }),
    }).catch(() => {});
    router.replace("/app/messages");
  };

  const remote = remoteParticipants[0];
  /** Cursor partajare ecran (P2P + DataChannel `align-cursor`). */
  useEffect(() => {
    if (isConference || !screenshareAllowed || audioOnly) return;
    const dc = cursorDataChannel;
    if (!dc || dc.readyState !== "open" || callState !== "connected") return;

    let detachReceiver: (() => void) | undefined;
    let detachSender: (() => void) | undefined;
    const t = window.setTimeout(() => {
      const isScreenShareActive = screenSharing;
      setCursorEnabled(isScreenShareActive);

      const remoteEl = remoteCursorOverlayRef.current;
      if (remoteEl) {
        detachReceiver = attachCursorReceiver({
          dc,
          overlayHostEl: remoteEl,
          defaultLabel: ui("cursorPresenterDefault"),
        });
      }
      if (isScreenShareActive) {
        const localEl = localCursorSendRef.current;
        if (localEl) {
          detachSender = attachCursorSender({
            dc,
            containerEl: localEl,
            label: displayName.trim() || undefined,
          });
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(t);
      setCursorEnabled(false);
      detachReceiver?.();
      detachSender?.();
    };
  }, [
    isConference,
    screenshareAllowed,
    audioOnly,
    cursorDataChannel,
    callState,
    screenSharing,
    displayName,
    videoLayoutSwapped,
    remote?.id,
    showMiniPreview,
    ui,
  ]);

  const immersiveVideo = !isConference && !audioOnly;
  const immersiveAudio = !isConference && audioOnly;
  /** O singură evaluare per render pentru preview local (immersive + grid). */
  const callVideoFraming = callVideoFramingClasses();

  const callStartupOverlayLabel = useCallback(
    (phase: CallUiPhase) => {
      if (!isConference) return ui("phaseWaitingPeer");
      switch (phase) {
        case "requesting_permissions":
          return ui("phaseRequestingPermissions");
        case "starting_media":
          return ui("phaseStartingMedia");
        case "connecting":
          if (isConference && waitingForPeerInRoom) return ui("confConnectingWaitPeers");
          if (isConference) return ui("confConnecting");
          return getP2pConnectingSubtitle(audioOnly, connectionPhase, waitingForPeerInRoom, true);
        case "reconnecting":
          return ui("reconnectingSubtitle");
        default:
          return ui("phaseConnectingGeneric");
      }
    },
    [ui, audioOnly, connectionPhase, waitingForPeerInRoom, getP2pConnectingSubtitle, isConference]
  );

  const showCallStartupOverlay =
    (immersiveVideo || immersiveAudio) &&
    callUiPhase !== "idle" &&
    callUiPhase !== "stable" &&
    callUiPhase !== "reconnecting" &&
    callUiPhase !== "failed";

  /** Evită același text în header și în overlay-ul central (pornire apel / permisiuni). */
  const hideImmersiveHeaderStatusForStartupOverlay = showCallStartupOverlay;

  const showConferenceStartupOverlay =
    isConference &&
    callUiPhase !== "idle" &&
    callUiPhase !== "stable" &&
    callUiPhase !== "reconnecting" &&
    callUiPhase !== "failed";

  const canSwapVideoLayout = Boolean(remote && localStream);
  const toggleVideoLayout = useCallback(() => {
    if (!remote || !localStream) return;
    setVideoLayoutSwapped((s) => !s);
  }, [remote, localStream]);

  useEffect(() => {
    if (!remote) setVideoLayoutSwapped(false);
  }, [remote]);

  useEffect(() => {
    if (callState !== "connected") setShowRemoteParticipantVideo(true);
  }, [callState]);

  useEffect(() => {
    setShowRemoteParticipantVideo(true);
  }, [remote?.id]);

  /** Pe laptop: camera oprită = păstrezi interlocutorul pe tot ecranul, fără chenar PiP cu icon în colț. */
  useEffect(() => {
    if (isConference || audioOnly) return;
    if (!isMobileUi && videoMuted) {
      setVideoLayoutSwapped(false);
    }
  }, [isConference, audioOnly, isMobileUi, videoMuted]);

  /** Buton circular bară jos (WhatsApp-style). `quiet` = fără umbre puternice (ex. laptop cu camera oprită). */
  const CircleBtn = ({
    onClick,
    title,
    active,
    danger,
    quiet,
    disabled,
    children,
  }: {
    onClick: () => void;
    title: string;
    active?: boolean;
    danger?: boolean;
    quiet?: boolean;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 sm:h-[3.75rem] sm:w-[3.75rem] ${
        danger
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600"
          : quiet
            ? "bg-white/10 text-white border border-white/18 hover:bg-white/16"
            : active
              ? "bg-white text-zinc-900 shadow-lg hover:bg-white/90"
              : "bg-white/12 text-white backdrop-blur-md hover:bg-white/20"
      } disabled:opacity-60 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );

  /** Apel audio: `videoMuted` e mereu true — nu folosi stilul „quiet” acolo. */
  const toolbarQuiet = !isMobileUi && videoMuted && !audioOnly;

  if (outgoingTerminal === "rejected") {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-night-950 px-4 text-center text-white">
          <p className="text-red-400 font-medium">{callTranslate.tStr("pages.callRoom.outgoingRejectedTitle")}</p>
          <p className="text-night-500 text-sm max-w-md">{callTranslate.tStr("pages.callRoom.outgoingRejectedBody")}</p>
          <Link replace href="/app/messages" className="text-brand-400 hover:underline mt-2">
            {callTranslate.tStr("pages.callRoom.backMessages")}
          </Link>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  if (outgoingTerminal === "unreachable") {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-night-950 px-4 text-center text-white">
          <p className="text-amber-400 font-medium">{callTranslate.tStr("pages.callRoom.outgoingUnreachableTitle")}</p>
          <p className="text-night-500 text-sm max-w-md">{callTranslate.tStr("pages.callRoom.outgoingUnreachableBody")}</p>
          <Link replace href="/app/messages" className="text-brand-400 hover:underline mt-2">
            {callTranslate.tStr("pages.callRoom.backMessages")}
          </Link>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  if (permissionHelp) {
    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-night-950 px-5 py-10 text-center text-white">
          <div className="max-w-lg rounded-2xl border border-amber-500/40 bg-amber-500/[0.12] px-6 py-6 text-left shadow-lg shadow-amber-900/20">
            <p className="text-amber-200/80 text-xs font-medium uppercase tracking-wide mb-2">
              {ui("permissionScreenTitle")}
            </p>
            <p className="text-amber-50 font-semibold text-lg mb-4">{permissionHelp.headline}</p>
            <ul className="text-amber-100/90 text-sm space-y-3 list-disc pl-5 leading-relaxed">
              {permissionHelp.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="text-amber-200/70 text-xs mt-5 border-t border-amber-500/25 pt-4">
              {ui("permissionFooterNote")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => retryPermissions()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-night-900 font-semibold hover:bg-brand-400 transition active:scale-[0.98]"
          >
            <RefreshCw className="w-5 h-5" aria-hidden />
            {ui("permissionRetryBtn")}
          </button>
          <Link
            replace
            href="/app/messages"
            className="text-brand-400 hover:text-brand-300 font-medium hover:underline"
          >
            {ui("permissionBackLink")}
          </Link>
        </div>
      </RemotePlaybackContext.Provider>
    );
  }

  if (error) {
    const errorRaw = callErrorRawForHints(error);
    const errNorm = errorRaw.normalize("NFKC");
    /** Erori SDP / createAnswer / setRemoteDescription — nu sunt „lipsesc variabile pe Vercel”. */
    const negotiationFail =
      (/\(answer\)|\(offer\)/i.test(errNorm) ||
        /Nu\s+am\s+putut\s+negocia/i.test(errNorm) ||
        /negocia\s+conexiunea/i.test(errNorm) ||
        /ofert[aă]?\s*WebRTC/i.test(errNorm) ||
        /Could\s+not\s+negotiate|Couldn't\s+negotiate|Couldn\u0027t\s+negotiate|negotiate\s+the\s+connection|negotiation\s+failed|WebRTC\s+offer|SDP/i.test(errNorm) ||
        /Verbindung.*(aus)?handel|Angebot.*WebRTC|Antwort.*WebRTC/i.test(errNorm));
    const authFail =
      /SIGNALING_TOKEN_INVALID|Neautorizat|Unauthorized|token semnalizare|signaling token|Signalisierungs-Token|autoriza semnalizarea|authorize signaling/i.test(
        errorRaw
      );
    const infraHint =
      !authFail &&
      /NEXT_PUBLIC|TURN_|ICE\/TURN|semnalizare|signaling|WebRTC nu e configurat|WebRTC este dezactivat|WebRTC is not configured|WebRTC is disabled|Eroare WebSocket|WebSocket signaling|\blips[aă]\b|missing|TURN_REQUIRED|Signaling is not configured|Signalisierung ist nicht konfiguriert|SIGNALING_NOT_CONFIGURED|TURN_NOT|TURN_CONFIG/i.test(
        errorRaw
      );
    const errorDisplay = resolveCallDisplayedError(error, (path) => callTranslate.tStr(path));

    return (
      <RemotePlaybackContext.Provider value={remotePlayback}>
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-night-950 px-4 py-10 text-white">
          <div
            className={`w-full max-w-lg rounded-2xl border px-6 py-8 shadow-xl ${
              negotiationFail
                ? "border-amber-500/35 bg-amber-500/[0.07]"
                : "border-red-500/25 bg-red-500/[0.06]"
            }`}
          >
            <div className="flex flex-col items-center text-center gap-2">
              {negotiationFail ? (
                <AlertCircle className="h-12 w-12 text-amber-400/90" aria-hidden />
              ) : (
                <ServerCog className="h-12 w-12 text-red-400/85" aria-hidden />
              )}
              <h2 className="text-lg font-semibold text-white tracking-tight">
                {negotiationFail
                  ? ui("errTitleNegotiation")
                  : authFail
                    ? callTranslate.tStr("pages.login.title")
                    : ui("errTitleInfra")}
              </h2>
              <p className="text-sm text-night-300/95 font-medium">{errorDisplay}</p>
            </div>

            {negotiationFail ? (
              <div className="mt-6 text-left text-sm text-amber-100/85 space-y-3 leading-relaxed border-t border-amber-500/20 pt-5">
                <p>{ui("errNegotiationIntro")}</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>{ui("errNegotiationBulletRetry")}</li>
                  <li>{ui("errNegotiationBulletSameMode")}</li>
                  <li>{ui("errNegotiationBulletNoDupTabs")}</li>
                  <li>{ui("errNegotiationBulletVpn")}</li>
                </ul>
              </div>
            ) : (
              <div className="mt-6 text-left text-sm text-night-400 space-y-4 leading-relaxed border-t border-red-500/15 pt-5">
                {infraHint ? (
                  <>
                    <p>{ui("errInfraIntro")}</p>
                    <p className="text-xs text-night-500 uppercase tracking-wide">{ui("errInfraVarsTitle")}</p>
                    <ul className="font-mono text-[11px] sm:text-xs text-brand-200/90 bg-night-900/80 rounded-lg px-3 py-3 space-y-1 border border-night-700/60">
                      <li>NEXT_PUBLIC_SIGNALING_WS_URL</li>
                      <li>NEXT_PUBLIC_TURN_URLS</li>
                      <li>TURN_REALM · TURN_STATIC_SECRET · TURN_AUTH_SECRET</li>
                    </ul>
                    {typeof window !== "undefined" && window.location.host ? (
                      <p className="text-xs text-night-500">
                        {ui("errInfraCurrentEnv")}{" "}
                        <code className="text-night-300 break-all">{window.location.host}</code>
                        {" — "}
                        <span className="text-night-500">{ui("errInfraPreviewNote")}</span>
                      </p>
                    ) : null}
                    <p className="text-xs">
                      <a
                        href="/api/webrtc-env-check"
                        className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
                      >
                        {ui("errInfraDiagnostics")}
                      </a>
                      {" — "}
                      {ui("errInfraDiagnosticsHint")}
                    </p>
                    <p className="text-xs text-night-500">{ui("errInfraDevHint")}</p>
                  </>
                ) : authFail ? (
                  <p>{errorDisplay}</p>
                ) : (
                  <p>{ui("errGenericProblem")}</p>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <button
                type="button"
                onClick={() => retryPermissions()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-night-900 font-semibold hover:bg-brand-400 transition active:scale-[0.98]"
              >
                <RefreshCw className="w-5 h-5 shrink-0" aria-hidden />
                {ui("retryConnectionBtn")}
              </button>
              <Link
                ref={errorBackMessagesRef}
                replace
                href="/app/messages"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-white/90 font-medium hover:bg-white/5 transition"
              >
                {callTranslate.tStr("pages.callRoom.backMessages")}
              </Link>
            </div>
          </div>
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

  const remotePlaybackHintBanner = remotePlaybackBlockedHint ? (
    <div className="relative z-[240] mx-3 mt-1 rounded-xl bg-amber-500/30 border border-amber-400/50 px-3 py-2 text-xs text-amber-50 shadow-lg backdrop-blur-sm">
      {ui("remotePlaybackBlocked")}
    </div>
  ) : null;

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
                aria-label={canSwapVideoLayout ? ui("swapLayoutSelfLargeAria") : undefined}
              >
                <RemoteVideoStageOptional
                  participant={remote}
                  overlayHostRef={remoteCursorOverlayRef}
                  videoVisible={showRemoteParticipantVideo}
                />
              </div>
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black"
                role="status"
                aria-live="polite"
                aria-label={
                  callUiPhase === "reconnecting"
                    ? ui("reconnectingSubtitle")
                    : !isConference && isConnectingLike
                      ? getP2pConnectingSubtitle(audioOnly, connectionPhase, waitingForPeerInRoom, isConnectingLike)
                      : waitingForPeerInRoom
                        ? ui("waitingAnswerOrJoinAria")
                        : isConnectingLike
                          ? ui("phaseConnectingGeneric")
                          : ui("phaseWaitingPeer")
                }
              >
                <div className="h-16 w-16 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin" />
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
              aria-label={canSwapVideoLayout ? ui("swapLayoutRemoteLargeAria") : undefined}
            >
              {localStream && !videoMuted ? (
                <div
                  id="localShareWrapper"
                  ref={localCursorSendRef}
                  className="absolute inset-0 h-full w-full overflow-hidden"
                >
                  <video
                    id="localShareVideo"
                    ref={bindLocalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 h-full w-full ${callVideoFraming.fit} ${callVideoFraming.zoom}`}
                  />
                </div>
              ) : localStream && videoMuted ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-black to-zinc-950">
                  <div className="h-28 w-28 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/15">
                    <VideoOff className="h-12 w-12 text-white/35" />
                  </div>
                  <p className="text-white/45 text-sm font-medium mt-4">{ui("cameraOffYours")}</p>
                </div>
              ) : null}
            </div>
          )}
          {showCallStartupOverlay ? (
            <div
              className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-5 bg-night-950 px-6 text-center pointer-events-none"
              role="status"
              aria-live="polite"
            >
              <DiebelWordmark variant="header" withMark className="text-white/90 [&_svg]:max-h-10" />
              <div
                className="h-12 w-12 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin shrink-0"
                aria-hidden
              />
              <p className="text-sm text-white/75 max-w-sm leading-relaxed">{callStartupOverlayLabel(callUiPhase)}</p>
            </div>
          ) : null}
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-200 ease-out ${chromeTopClass}`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-200 ease-out ${chromeBottomClass}`}
        />

        <header
          className={`relative z-20 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 sm:px-4 transition-opacity duration-200 ease-out ${chromeTopClass}`}
        >
          <button
            type="button"
            onClick={handleLeave}
            disabled={leavingCall}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition"
            aria-label={ui("closeCallAria")}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="pointer-events-none flex flex-col items-center text-center px-2 min-w-0">
            <span className="font-semibold text-base sm:text-lg truncate max-w-[60vw]">
              {remote?.displayName || ui("headerVideoCall")}
            </span>
            {!hideImmersiveHeaderStatusForStartupOverlay && p2pImmersiveHeaderStatusText ? (
              <span className="text-xs text-white/55 tabular-nums">{p2pImmersiveHeaderStatusText}</span>
            ) : null}
          </div>
          <div className="w-11 shrink-0" aria-hidden />
        </header>

        <ReconnectHintPanel
          active={reconnectPanelActive}
          iceRecoveryInFlight={iceRecoveryInFlight}
          long1={showReconnectLong1}
          long2={showReconnectLong2}
          ui={ui}
          className={`relative z-20 mx-3 mt-1 transition-[opacity,transform] duration-200 ease-out ${chromeTopClass}`}
          bannerClassName="rounded-xl border border-sky-500/40 bg-sky-950/95 px-3 py-2 text-xs text-sky-50"
        />
        {banner ? (
          <div
            className={`relative z-20 mx-3 mt-1 rounded-xl bg-amber-500/20 border border-amber-400/35 px-3 py-2 text-xs text-amber-50 backdrop-blur-sm transition-[opacity,transform] duration-200 ease-out ${chromeTopClass}`}
          >
            {banner}
          </div>
        ) : null}
        {transientRingNotify ? (
          <div
            className={`relative z-20 mx-3 mt-1 max-h-[4.25rem] overflow-y-auto rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2 text-left text-xs leading-snug text-sky-50/95 backdrop-blur-sm transition-opacity duration-200 ease-out break-words ${chromeTopClass}`}
            role="status"
          >
            {transientRingNotify}
          </div>
        ) : null}
        {remotePlaybackHintBanner}

        {/* PiP: tu mic / după swap celălalt mic. Tap pe mini = ascunde/arată preview; tap pe video mare = swap layout. */}
        {!videoLayoutSwapped && localStream && !videoMuted && showMiniPreview && (
          <div
            id="localShareWrapper"
            ref={localCursorSendRef}
            className={pipFrameClass}
            onClick={(e) => {
              e.stopPropagation();
              setShowMiniPreview((v) => !v);
            }}
            role="button"
            tabIndex={0}
            aria-label={ui("pipToggleHideAria")}
          >
            <video
              id="localShareVideo"
              ref={bindLocalVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full ${callVideoFraming.fit} ${callVideoFraming.zoom}`}
            />
          </div>
        )}
        {!videoLayoutSwapped && localStream && videoMuted && showMiniPreview && (
          <div
            className={`${pipFrameClass} flex flex-col items-center justify-center gap-1 bg-zinc-800/95 ring-white/15 px-1`}
            onClick={(e) => {
              e.stopPropagation();
              setShowMiniPreview((v) => !v);
            }}
            role="button"
            tabIndex={0}
            aria-label={ui("pipToggleShowAria")}
          >
            <VideoOff className={isMobileUi ? "h-8 w-8 text-white/35" : "h-7 w-7 text-white/35"} />
            <span className="text-[9px] leading-tight text-center text-white/50 px-0.5">
              {cameraSoftFailed ? ui("pipMutedLabelNoCam") : ui("pipMutedLabelOff")}
            </span>
          </div>
        )}
        {videoLayoutSwapped && remote && showMiniPreview && (
          <div
            className={pipFrameClass}
            onClick={(e) => {
              e.stopPropagation();
              setShowMiniPreview((v) => !v);
            }}
            role="button"
            tabIndex={0}
            aria-label={ui("pipToggleShowAria")}
          >
            <div className="relative h-full w-full">
              <RemoteVideoStageOptional
                participant={remote}
                overlayHostRef={remoteCursorOverlayRef}
                videoVisible={showRemoteParticipantVideo}
                variant="pip"
              />
            </div>
            <span className="pointer-events-none absolute bottom-1.5 left-2 right-2 truncate text-[10px] font-medium uppercase tracking-wider text-white/80 bg-black/50 px-1.5 py-0.5 rounded max-w-[calc(100%-0.5rem)]">
              {remote.displayName || ui("participantFallback")}
            </span>
          </div>
        )}
        {/* Partajare ecran: container pentru cursor când mini-preview e ascuns (fără tile vizibil). */}
        {!showMiniPreview && screenSharing && !videoLayoutSwapped && (
          <div
            ref={localCursorSendRef}
            className="pointer-events-none fixed top-0 left-0 h-px w-px overflow-hidden opacity-0"
            aria-hidden
          />
        )}
        <audio ref={bindLocalAudioRef} autoPlay playsInline muted className="hidden" />

        <div
          className={`relative z-20 mt-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3
            pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 transition-[opacity,transform] duration-200 ease-out ${chromeBottomClass}`}
        >
          <CircleBtn
            onClick={onMicToggle}
            quiet={toolbarQuiet}
            title={
              privacyQuietMode
                ? ui("titleMicQuietMode")
                : muted
                  ? ui("titleMicOn")
                  : ui("titleMicOff")
            }
            active={!muted}
          >
            {muted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          <CircleBtn
            onClick={() => setVideoMuted(!videoMuted)}
            quiet={toolbarQuiet}
            title={videoMuted ? ui("titleCamOn") : ui("titleCamOff")}
            active={!videoMuted}
          >
            {videoMuted ? <VideoOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Video className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          <button
            type="button"
            onClick={() => setShowMiniPreview((v) => !v)}
            className="pointer-events-auto shrink-0 max-w-[11rem] rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 text-center text-[11px] font-medium leading-tight text-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98] sm:max-w-[14rem] sm:px-3 sm:text-xs"
          >
            {showMiniPreview ? ui("toggleMiniHide") : ui("toggleMiniShow")}
          </button>
          {remote ? (
            <CircleBtn
              onClick={() => setShowRemoteParticipantVideo((v) => !v)}
              quiet={toolbarQuiet}
              title={
                showRemoteParticipantVideo
                  ? ui("titleRemoteVideoHide")
                  : ui("titleRemoteVideoShow")
              }
              active={showRemoteParticipantVideo}
            >
              {showRemoteParticipantVideo ? (
                <UserRound className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : (
                <UserRoundX className="h-6 w-6 sm:h-7 sm:w-7" />
              )}
            </CircleBtn>
          ) : null}
          {showCameraFlip && (
            <CircleBtn
              onClick={() => void switchCamera()}
              title={ui("titleCameraFlip")}
            >
              <RefreshCw className="h-6 w-6 sm:h-7 sm:w-7" />
            </CircleBtn>
          )}
          {screenshareAllowed && (
            <CircleBtn
              onClick={() => void toggleScreenShare()}
              title={screenSharing ? ui("titleScreenshareStop") : ui("titleScreenshareStart")}
              active={screenSharing}
            >
              <MonitorUp className="h-6 w-6 sm:h-7 sm:w-7" />
            </CircleBtn>
          )}
          {showSpeakerToggle ? (
            <CircleBtn
              onClick={() => setSpeakerOutputOn((v) => !v)}
              title={speakerOutputOn ? ui("titleSpeakerDefault") : ui("titleSpeaker")}
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
                ? ui("titlePrivacyExit")
                : ui("titlePrivacyEnter")
            }
            danger={privacyQuietMode}
            active={!privacyQuietMode}
          >
            <PrivacyQuietIcon
              active={privacyQuietMode}
              showSpeakerToggle={!!showSpeakerToggle}
              className="h-6 w-6 sm:h-7 sm:w-7"
            />
          </CircleBtn>
          <CircleBtn onClick={handleLeave} title={ui("titleCloseCall")} danger disabled={leavingCall}>
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
          className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-200 ease-out ${chromeTopClass}`}
        />
        <header
          className={`relative z-10 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 transition-[opacity,transform] duration-200 ease-out ${chromeTopClass}`}
        >
          <button
            type="button"
            onClick={handleLeave}
            disabled={leavingCall}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
            aria-label={ui("audioHeaderBackAria")}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="text-center min-w-0 px-2">
            <p className="font-semibold text-lg truncate">{remote?.displayName || ui("headerAudioCall")}</p>
            {!hideImmersiveHeaderStatusForStartupOverlay && p2pImmersiveHeaderStatusText ? (
              <p className="text-xs text-white/50 tabular-nums">{p2pImmersiveHeaderStatusText}</p>
            ) : null}
          </div>
          <div className="w-11" />
        </header>

        <ReconnectHintPanel
          active={reconnectPanelActive}
          iceRecoveryInFlight={iceRecoveryInFlight}
          long1={showReconnectLong1}
          long2={showReconnectLong2}
          ui={ui}
          className={`relative z-10 mx-4 mt-1 transition-[opacity,transform] duration-200 ease-out ${chromeTopClass}`}
          bannerClassName="rounded-xl border border-sky-500/40 bg-sky-950/95 px-3 py-2 text-xs text-sky-50"
        />
        {transientRingNotify ? (
          <div
            className={`relative z-10 mx-4 mt-1 max-h-[4.25rem] overflow-y-auto rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2 text-left text-xs leading-snug text-sky-50/95 transition-[opacity,transform] duration-200 ease-out break-words ${chromeTopClass}`}
            role="status"
          >
            {transientRingNotify}
          </div>
        ) : null}

        <div className="relative flex flex-1 flex-col items-center justify-center px-6 -mt-8">
          {showCallStartupOverlay ? (
            <div
              className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-5 bg-night-950 px-6 text-center pointer-events-none"
              role="status"
              aria-live="polite"
            >
              <DiebelWordmark variant="header" withMark className="text-white/90 [&_svg]:max-h-10" />
              <div
                className="h-12 w-12 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin shrink-0"
                aria-hidden
              />
              <p className="text-sm text-white/75 max-w-sm leading-relaxed">{callStartupOverlayLabel(callUiPhase)}</p>
            </div>
          ) : null}
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-3xl scale-150" />
            <div className="relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 ring-2 ring-white/20 shadow-2xl">
              <span className="text-5xl sm:text-6xl font-light text-white/90">
                {(remote?.displayName || displayName || "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
          </div>
          <p className="text-white/40 text-sm">{ui("audioCallSecureBadge")}</p>
          {remote?.stream ? <RemoteAudio stream={remote.stream} /> : null}
        </div>

        <audio ref={bindLocalAudioRef} autoPlay playsInline muted className="hidden" />

        {banner ? (
          <div
            className={`mx-4 mb-2 rounded-xl bg-amber-500/20 border border-amber-400/35 px-3 py-2 text-xs text-amber-50 transition-[opacity,transform] duration-200 ease-out ${chromeBottomClass}`}
          >
            {banner}
          </div>
        ) : null}
        {remotePlaybackBlockedHint ? (
          <div className="relative z-[240] mx-4 mb-2 rounded-xl bg-amber-500/30 border border-amber-400/50 px-3 py-2 text-xs text-amber-50 shadow-lg">
            {ui("remotePlaybackBlocked")}
          </div>
        ) : null}

        <div
          className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 transition-[opacity,transform] duration-200 ease-out ${chromeBottomClass}`}
        >
          <CircleBtn
            onClick={onMicToggle}
            quiet={toolbarQuiet}
            title={
              privacyQuietMode
                ? ui("audioTitleMicQuiet")
                : muted
                  ? ui("audioTitleMicOn")
                  : ui("audioTitleMicMute")
            }
            active={!muted}
          >
            {muted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          {showSpeakerToggle ? (
            <CircleBtn
              onClick={() => setSpeakerOutputOn((v) => !v)}
              title={speakerOutputOn ? ui("audioTitleSpeakerDefault") : ui("titleSpeaker")}
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
                ? ui("audioTitlePrivacyExit")
                : ui("audioTitlePrivacyEnter")
            }
            danger={privacyQuietMode}
            active={!privacyQuietMode}
          >
            <PrivacyQuietIcon
              active={privacyQuietMode}
              showSpeakerToggle={!!showSpeakerToggle}
              className="h-6 w-6 sm:h-7 sm:w-7"
            />
          </CircleBtn>
          <CircleBtn onClick={handleLeave} title={ui("audioTitleClose")} danger disabled={leavingCall}>
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
    <div className="fixed inset-0 z-[200] flex flex-col bg-night-950 text-night-100 overflow-hidden">
      <div className="flex items-center justify-between border-b border-night-600 py-2 px-3 sm:px-4 shrink-0">
        <Link replace href="/app/messages" onClick={() => leave()} className="text-night-500 hover:text-white text-sm">
          {ui("confBarMessagesLink")}
        </Link>
        <span className="text-night-500 text-sm">
          {callUiPhase === "reconnecting"
            ? ui("reconnectingSubtitle")
            : !showConferenceStartupOverlay &&
                isConnectingLike &&
                (!isConference
                  ? getP2pConnectingSubtitle(audioOnly, connectionPhase, waitingForPeerInRoom, isConnectingLike)
                  : waitingForPeerInRoom
                    ? ui("confConnectingWaitPeers")
                    : ui("confConnecting"))}
          {callState === "connected" &&
            callUiPhase !== "reconnecting" &&
            (isConference ? ui("confConnectedConference") : ui("confConnectedCall"))}
          {callState === "ended" && ui("confEnded")}
        </span>
        {isConference && callState === "connected" && (
          <button
            type="button"
            onClick={() => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/app/call/${roomId}` : "";
              navigator.clipboard
                ?.writeText(url)
                .then(() => alert(ui("confInviteCopied")))
                .catch(() => {});
            }}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            {ui("confInvite")}
          </button>
        )}
        {!isConference && <span className="w-16" />}
      </div>

      <ReconnectHintPanel
        active={reconnectPanelActive}
        iceRecoveryInFlight={iceRecoveryInFlight}
        long1={showReconnectLong1}
        long2={showReconnectLong2}
        ui={ui}
        className="mx-4 mt-2"
        bannerClassName="rounded-lg border border-sky-500/40 bg-sky-950/95 px-3 py-2 text-sm text-sky-50"
      />
      {banner ? (
        <div className="mx-4 mt-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-sm text-amber-100">
          {banner}
        </div>
      ) : null}
      {transientRingNotify ? (
        <div
          className="mx-4 mt-2 max-h-[4.5rem] overflow-y-auto rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-left text-sm leading-snug text-sky-100/90 break-words"
          role="status"
        >
          {transientRingNotify}
        </div>
      ) : null}
      {remotePlaybackHintBanner}

      <div className="relative flex flex-1 min-h-0 flex-col">
        {showConferenceStartupOverlay ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-night-950 px-5 text-center pointer-events-none"
            role="status"
            aria-live="polite"
          >
            <DiebelWordmark variant="header" withMark className="text-white/90 [&_svg]:max-h-9" />
            <div
              className="h-10 w-10 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin shrink-0"
              aria-hidden
            />
            <p className="text-sm text-white/70 max-w-sm leading-relaxed">
              {callStartupOverlayLabel(callUiPhase)}
            </p>
          </div>
        ) : null}
        <div
          className={`grid flex-1 min-h-0 gap-3 p-3 sm:p-4 overflow-auto ${
            isConference ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 max-w-3xl mx-auto w-full"
          }`}
        >
        <div className="relative rounded-2xl overflow-hidden bg-night-800 border border-white/10 aspect-video shadow-lg">
          <video
            ref={bindLocalVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full ${callVideoFraming.fit} ${callVideoFraming.zoom}`}
          />
          <audio ref={bindLocalAudioRef} autoPlay playsInline muted className="hidden" />
        </div>

        {remoteParticipants.map((p) => (
          <RemoteVideoCard key={p.id} participant={p} />
        ))}

        {callState === "connected" && remoteParticipants.length === 0 && (
          <div className="flex items-center justify-center text-night-500 col-span-full min-h-[12rem]">
            {ui("waitParticipantsGrid")}
          </div>
        )}
      </div>
      </div>

      <div className="flex flex-wrap shrink-0 items-center justify-center gap-2 sm:gap-3 border-t border-night-600 bg-night-950/90 py-3 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onMicToggle}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
            muted ? "bg-red-500/25 text-red-300" : "bg-night-600 text-white hover:bg-night-500"
          }`}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {privacyQuietMode ? ui("toolbarMicDiscrete") : muted ? ui("toolbarMicUnmute") : ui("toolbarMicMute")}
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
            {videoMuted ? ui("toolbarVideoStart") : ui("toolbarVideoStop")}
          </button>
        )}
        {showCameraFlip && (
          <button
            type="button"
            onClick={() => void switchCamera()}
            title={ui("toolbarFlipTitle")}
            className="flex items-center gap-2 rounded-full bg-night-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-night-500"
          >
            <RefreshCw className="w-5 h-5" />
            {ui("toolbarFlipLabel")}
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
            {ui("toolbarScreen")}
          </button>
        )}
        {showSpeakerToggle ? (
          <button
            type="button"
            onClick={() => setSpeakerOutputOn((v) => !v)}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              speakerOutputOn ? "bg-brand-500/25 text-brand-200" : "bg-night-600 text-white hover:bg-night-500"
            }`}
            title={speakerOutputOn ? ui("toolbarSpeakerDefaultTitle") : ui("titleSpeaker")}
          >
            {speakerOutputOn ? <Volume2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            {speakerOutputOn ? ui("toolbarSpeakerOn") : ui("toolbarPhone")}
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
              ? ui("toolbarDiscreteExit")
              : ui("toolbarDiscreteEnter")
          }
        >
          <PrivacyQuietIcon
            active={privacyQuietMode}
            showSpeakerToggle={!!showSpeakerToggle}
            className="w-5 h-5"
          />
          {privacyQuietMode ? ui("toolbarNormal") : ui("toolbarDiscrete")}
        </button>
        <button
          type="button"
          onClick={handleLeave}
          disabled={leavingCall}
          className="flex items-center gap-2 rounded-full bg-red-500/25 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/35"
        >
          <PhoneOff className="w-5 h-5" />
          {ui("toolbarClose")}
        </button>
      </div>
    </div>
    </RemotePlaybackContext.Provider>
  );
}
