"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneOff, Mic, MicOff, Video, VideoOff, RefreshCw, MonitorUp } from "lucide-react";
import { useWebRtcCall, type RemoteParticipant } from "@/hooks/useWebRtcCall";
import { getAuthHeaders } from "@/lib/authClient";
import { isScreenshareFeatureEnabled } from "@/lib/env/webrtcConfig";

function RemoteVideo({ participant }: { participant: RemoteParticipant }) {
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
    <div className="relative rounded-xl overflow-hidden bg-dark-800 border border-dark-600 aspect-video">
      {hasLiveVideo ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-dark-500">Fără video</div>
      )}
      {participant.stream?.getAudioTracks().length ? <RemoteAudio stream={participant.stream} /> : null}
      <span className="absolute bottom-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded truncate max-w-[80%]">
        {participant.displayName || participant.id}
      </span>
    </div>
  );
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

const OUTGOING_POLL_MS = 1000;

type CallUIProps = {
  roomId: string;
  userId: string;
  displayName: string;
  audioOnly: boolean;
  isConference: boolean;
  isCaller?: boolean;
};

export default function CallUI({ roomId, userId, displayName, audioOnly, isConference, isCaller: isCallerProp }: CallUIProps) {
  const router = useRouter();
  const [callRejected, setCallRejected] = useState(false);
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

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between py-2 border-b border-dark-600 px-2">
        <Link href="/app/messages" className="text-dark-500 hover:text-white text-sm">
          ← Închide apelul
        </Link>
        <span className="text-dark-500 text-sm">
          {status === "connecting" && "Se conectează…"}
          {status === "connected" && (isConference ? "Conferință" : "Apel 1-la-1")}
          {status === "left" && "Apel încheiat"}
        </span>
        {isConference && status === "connected" && (
          <button
            type="button"
            onClick={() => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/app/call/${roomId}` : "";
              navigator.clipboard
                ?.writeText(url)
                .then(() => alert("Link copiat! Trimite-l pentru a adăuga participanți."))
                .catch(() => {});
            }}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            Adaugă participanți
          </button>
        )}
      </div>

      {banner ? (
        <div className="mx-4 mt-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-sm text-amber-100">
          {banner}
        </div>
      ) : null}

      <div className={`flex-1 min-h-0 p-4 ${isConference ? "grid grid-cols-2 gap-3 overflow-auto" : "flex flex-col gap-3"}`}>
        <div className="relative rounded-xl overflow-hidden bg-dark-800 border border-dark-600 aspect-video shrink-0">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <audio ref={localAudioRef} autoPlay playsInline muted className="hidden" />
          <span className="absolute bottom-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded">Tu</span>
        </div>

        {remoteParticipants.map((p) => (
          <RemoteVideo key={p.id} participant={p} />
        ))}

        {status === "connected" && remoteParticipants.length === 0 && (
          <div className="flex items-center justify-center text-dark-500 col-span-2">
            Așteptăm celălalt participant…
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 py-4 border-t border-dark-600 bg-dark-900/80">
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition ${muted ? "bg-red-500/20 text-red-400" : "bg-dark-600 text-white hover:bg-dark-500"}`}
          title={muted ? "Activează microfonul" : "Mute"}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          <span className="text-sm font-medium">{muted ? "Mute" : "Mute"}</span>
        </button>
        {!audioOnly && (
          <button
            type="button"
            onClick={() => setVideoMuted(!videoMuted)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition ${videoMuted ? "bg-red-500/20 text-red-400" : "bg-dark-600 text-white hover:bg-dark-500"}`}
            title={videoMuted ? "Pornește camera" : "Oprește camera"}
          >
            {videoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            <span className="text-sm font-medium">{videoMuted ? "Oprește camera" : "Oprește camera"}</span>
          </button>
        )}
        {!audioOnly && canSwitchCamera && (
          <button
            type="button"
            onClick={() => void switchCamera()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition bg-dark-600 text-white hover:bg-dark-500"
            title="Schimbă camera"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm font-medium">Cameră</span>
          </button>
        )}
        {!audioOnly && screenshareAllowed && (
          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition ${screenSharing ? "bg-amber-500/20 text-amber-400" : "bg-dark-600 text-white hover:bg-dark-500"}`}
            title={screenSharing ? "Oprește partajarea ecranului" : "Partajare ecran"}
          >
            <MonitorUp className="w-5 h-5" />
            <span className="text-sm font-medium">{screenSharing ? "Oprește ecran" : "Ecran"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleLeave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
          title="Închide apelul"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="text-sm font-medium">Închide apelul</span>
        </button>
      </div>
    </div>
  );
}
