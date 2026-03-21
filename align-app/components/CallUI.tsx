"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneOff, Mic, MicOff, Video, VideoOff, RefreshCw, MonitorUp, ChevronLeft } from "lucide-react";
import { useWebRtcCall, type RemoteParticipant } from "@/hooks/useWebRtcCall";
import { getAuthHeaders } from "@/lib/authClient";
import { isScreenshareFeatureEnabled } from "@/lib/env/webrtcConfig";

function fmtCallDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
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
    <div className="relative rounded-2xl overflow-hidden bg-dark-800 border border-white/10 aspect-video shadow-xl">
      {hasLiveVideo ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-dark-800 to-dark-950 text-dark-400 gap-2">
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
  const isCaller = !!isCallerProp && !isConference;

  const screenshareAllowed = isScreenshareFeatureEnabled();

  const {
    status,
    error,
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
  } = useWebRtcCall({
    roomId,
    userId,
    displayName,
    audioOnly,
    isCaller,
    isConference,
    onAutoEnded: () => router.push("/app/messages"),
  });

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
  }, [localStream]);

  useEffect(() => {
    if (status !== "connected") {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

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
    fetch("/api/call/end", { method: "POST", headers: getAuthHeaders() }).catch(() => {});
    router.push("/app/messages");
  };

  const remote = remoteParticipants[0];
  const immersiveVideo = !isConference && !audioOnly;
  const immersiveAudio = !isConference && audioOnly;

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
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
        <p className="text-red-400 font-medium">Apel respins</p>
        <p className="text-dark-500 text-sm">Celălalt utilizator a refuzat apelul. Redirecționare la mesaje…</p>
        <Link href="/app/messages" className="text-brand-400 hover:underline mt-2">
          Înapoi la mesaje
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
        <p className="text-red-400 font-medium">{error}</p>
        <p className="text-dark-500 text-sm max-w-md">
          Verifică <code className="text-dark-400">docs/calls.md</code>: server semnalizare (WS), coturn/TURN, variabilele{" "}
          <code className="text-dark-400">NEXT_PUBLIC_SIGNALING_WS_URL</code>,{" "}
          <code className="text-dark-400">NEXT_PUBLIC_TURN_URLS</code>, <code className="text-dark-400">TURN_AUTH_SECRET</code>.
        </p>
        <Link href="/app/messages" className="text-brand-400 hover:underline mt-2">
          Înapoi la mesaje
        </Link>
      </div>
    );
  }

  /* ——— Apel video 1-la-1: fullscreen + PiP ——— */
  if (immersiveVideo) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-black text-white">
        <div className="absolute inset-0 overflow-hidden">
          {remote ? (
            <RemoteVideoStage participant={remote} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
              <div className="h-16 w-16 border-2 border-white/20 border-t-brand-400 rounded-full animate-spin mb-6" />
              <p className="text-white/60 text-sm">
                {status === "connecting" ? "Se conectează…" : "Așteptăm celălalt participant…"}
              </p>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/85 via-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        <header className="relative z-20 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 sm:px-4">
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
          <div className="relative z-20 mx-3 mt-1 rounded-xl bg-amber-500/20 border border-amber-400/35 px-3 py-2 text-xs text-amber-50 backdrop-blur-sm">
            {banner}
          </div>
        ) : null}

        {/* PiP local — oglindit ca la majoritatea apelurilor */}
        {localStream && !videoMuted && (
          <div
            className="absolute z-20 overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-2 ring-white/20
              right-[max(0.75rem,env(safe-area-inset-right))]
              bottom-[calc(7.25rem+env(safe-area-inset-bottom))]
              w-[min(34vw,11rem)] sm:w-44 sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom))] md:w-52 aspect-video"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover scale-x-[-1]"
            />
            <span className="absolute bottom-1.5 left-2 text-[10px] font-medium uppercase tracking-wider text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
              Tu
            </span>
          </div>
        )}
        {localStream && videoMuted && (
          <div
            className="absolute z-20 flex items-center justify-center rounded-2xl bg-zinc-800/95 shadow-2xl ring-2 ring-white/15
              right-[max(0.75rem,env(safe-area-inset-right))]
              bottom-[calc(7.25rem+env(safe-area-inset-bottom))]
              w-[min(34vw,11rem)] sm:w-44 aspect-video"
          >
            <VideoOff className="h-8 w-8 text-white/35" />
          </div>
        )}
        <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />

        <div
          className="relative z-20 mt-auto flex flex-wrap items-center justify-center gap-3 sm:gap-5 px-3
            pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
        >
          <CircleBtn
            onClick={() => setMuted(!muted)}
            title={muted ? "Pornește microfonul" : "Dezactivează microfonul"}
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
          {canSwitchCamera && (
            <CircleBtn onClick={() => void switchCamera()} title="Schimbă camera">
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
          <CircleBtn onClick={handleLeave} title="Închide apelul" danger>
            <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
          </CircleBtn>
        </div>
      </div>
    );
  }

  /* ——— Apel audio 1-la-1: ecran dedicat, fără casete video mici ——— */
  if (immersiveAudio) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-zinc-900 via-black to-zinc-950 text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
        <header className="relative z-10 flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
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
          <div className="mx-4 mb-2 rounded-xl bg-amber-500/20 border border-amber-400/35 px-3 py-2 text-xs text-amber-50">
            {banner}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <CircleBtn onClick={() => setMuted(!muted)} title={muted ? "Pornește microfonul" : "Mute"} active={!muted}>
            {muted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
          </CircleBtn>
          <CircleBtn onClick={handleLeave} title="Închide" danger>
            <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
          </CircleBtn>
        </div>
      </div>
    );
  }

  /* ——— Conferință sau fallback ——— */
  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between border-b border-dark-600 py-2 px-3 sm:px-4">
        <Link href="/app/messages" onClick={() => leave()} className="text-dark-500 hover:text-white text-sm">
          ← Mesaje
        </Link>
        <span className="text-dark-500 text-sm">
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
        <div className="relative rounded-2xl overflow-hidden bg-dark-800 border border-white/10 aspect-video shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />
          <span className="absolute bottom-2 left-2 text-xs bg-black/55 backdrop-blur-sm px-2 py-1 rounded-lg">Tu</span>
        </div>

        {remoteParticipants.map((p) => (
          <RemoteVideoCard key={p.id} participant={p} />
        ))}

        {status === "connected" && remoteParticipants.length === 0 && (
          <div className="flex items-center justify-center text-dark-500 col-span-full min-h-[12rem]">
            Așteptăm participanți…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 border-t border-dark-600 bg-dark-950/90 py-3 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
            muted ? "bg-red-500/25 text-red-300" : "bg-dark-600 text-white hover:bg-dark-500"
          }`}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {muted ? "Pornește mic." : "Mute"}
        </button>
        {!audioOnly && (
          <button
            type="button"
            onClick={() => setVideoMuted(!videoMuted)}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              videoMuted ? "bg-red-500/25 text-red-300" : "bg-dark-600 text-white hover:bg-dark-500"
            }`}
          >
            {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            {videoMuted ? "Pornește video" : "Oprește video"}
          </button>
        )}
        {!audioOnly && canSwitchCamera && (
          <button
            type="button"
            onClick={() => void switchCamera()}
            className="flex items-center gap-2 rounded-full bg-dark-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-dark-500"
          >
            <RefreshCw className="w-5 h-5" />
            Cameră
          </button>
        )}
        {!audioOnly && screenshareAllowed && (
          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              screenSharing ? "bg-amber-500/25 text-amber-300" : "bg-dark-600 text-white hover:bg-dark-500"
            }`}
          >
            <MonitorUp className="w-5 h-5" />
            Ecran
          </button>
        )}
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
  );
}
