"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useJitsiRoom, loadJitsiScript, JITSI_DOMAIN, type RemoteParticipant } from "@/lib/useJitsiRoom";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { getAuthHeaders } from "@/lib/authClient";

/** Atașează un track Jitsi la un element media: folosește getStream() sau attach() după disponibilitate. */
function useAttachTrack(
  track: unknown | null,
  isVideo: boolean
) {
  const ref = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    const t = track as { getStream?: () => MediaStream; attach?: (el: HTMLElement) => void; getOriginalStream?: () => MediaStream };
    const stream = t.getStream?.() ?? t.getOriginalStream?.();
    if (stream) {
      el.srcObject = stream;
      return () => {
        el.srcObject = null;
      };
    }
    if (typeof t.attach === "function") {
      t.attach(el as unknown as HTMLElement);
      return () => {
        try {
          (track as { detach?: (el: HTMLElement) => void }).detach?.(el as unknown as HTMLElement);
        } catch {}
      };
    }
  }, [track, isVideo]);
  return ref;
}

function RemoteVideo({ participant }: { participant: RemoteParticipant }) {
  const videoTrack = participant.videoTrack;
  const audioTrack = participant.audioTrack;
  const videoRef = useAttachTrack(videoTrack, true);
  const audioRef = useAttachTrack(audioTrack, false);

  return (
    <div className="relative rounded-xl overflow-hidden bg-dark-800 border border-dark-600 aspect-video">
      {videoTrack ? (
        <video ref={videoRef as React.RefObject<HTMLVideoElement>} autoPlay playsInline muted={false} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-dark-500">Fără video</div>
      )}
      {audioTrack ? <audio ref={audioRef as React.RefObject<HTMLAudioElement>} autoPlay playsInline className="hidden" /> : null}
      <span className="absolute bottom-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded truncate max-w-[80%]">
        {participant.displayName || participant.id}
      </span>
    </div>
  );
}

const OUTGOING_POLL_MS = 1000;

type CallUIProps = {
  roomId: string;
  displayName: string;
  audioOnly: boolean;
  isConference: boolean;
  isCaller?: boolean;
};

export default function CallUI({ roomId, displayName, audioOnly, isConference, isCaller: isCallerProp }: CallUIProps) {
  const router = useRouter();
  const [callRejected, setCallRejected] = useState(false);
  const isCaller = !!isCallerProp && !isConference;

  const {
    status,
    error,
    remoteParticipants,
    muted,
    setMuted,
    videoMuted,
    setVideoMuted,
    leave,
    localVideoTrack,
    localAudioTrack,
  } = useJitsiRoom({
    roomId,
    displayName,
    audioOnly,
    onLeft: () => router.push("/app/messages"),
  });

  const localVideoRef = useAttachTrack(localVideoTrack, true) as React.RefObject<HTMLVideoElement>;
  const localAudioRef = useAttachTrack(localAudioTrack, false) as React.RefObject<HTMLAudioElement>;

  useEffect(() => {
    loadJitsiScript(JITSI_DOMAIN).catch(() => {});
  }, []);

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
        <Link href="/app/messages" className="text-brand-400 hover:underline mt-2">Înapoi la mesaje</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
        <p className="text-red-400 font-medium">{error}</p>
        <p className="text-dark-500 text-sm max-w-md">
          Pe serverul public (meet.jit.si) conexiunea directă din aplicație e adesea blocată. Pentru apeluri cu interfața ta: folosește un server Jitsi propriu (<code className="text-dark-400">NEXT_PUBLIC_JITSI_DOMAIN</code> în .env). Poți încerca și reîmprospătarea paginii.
        </p>
        <Link href="/app/messages" className="text-brand-400 hover:underline mt-2">Înapoi la mesaje</Link>
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
        </span>
        {isConference && status === "connected" && (
          <button
            type="button"
            onClick={() => {
              const url = typeof window !== "undefined" ? `${window.location.origin}/app/call/${roomId}` : "";
              navigator.clipboard?.writeText(url).then(() => alert("Link copiat! Trimite-l pentru a adăuga participanți.")).catch(() => {});
            }}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            Adaugă participanți
          </button>
        )}
      </div>

      {/* Zona video: local + remote(e) */}
      <div className={`flex-1 min-h-0 p-4 ${isConference ? "grid grid-cols-2 gap-3 overflow-auto" : "flex flex-col gap-3"}`}>
        {/* Local video - placeholder până expunem track-urile locale din hook */}
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

      {/* Doar 3 butoane */}
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
