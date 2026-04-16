"use client";

// LEGACY / OPTIONAL – NOT PRIMARY CALL PATH (apelurile principale sunt WebRTC în `hooks/useWebRtcCall.ts`).

import { useEffect, useRef, useState, useCallback } from "react";

const JITSI_DOMAIN = typeof process.env.NEXT_PUBLIC_JITSI_DOMAIN === "string" && process.env.NEXT_PUBLIC_JITSI_DOMAIN
  ? process.env.NEXT_PUBLIC_JITSI_DOMAIN.replace(/^https?:\/\//, "").split("/")[0]
  : "meet.jit.si";

export type RemoteParticipant = {
  id: string;
  displayName: string;
  videoTrack: unknown | null;
  audioTrack: unknown | null;
};

type JitsiRoomState = {
  status: "idle" | "connecting" | "connected" | "left" | "error";
  error: string | null;
  remoteParticipants: RemoteParticipant[];
  muted: boolean;
  videoMuted: boolean;
  localVideoTrack: unknown | null;
  localAudioTrack: unknown | null;
};

export type UseJitsiRoomOptions = {
  roomId: string;
  displayName: string;
  audioOnly: boolean;
  onLeft?: () => void;
};

export function useJitsiRoom({
  roomId,
  displayName,
  audioOnly,
  onLeft,
}: UseJitsiRoomOptions) {
  const [state, setState] = useState<JitsiRoomState>({
    status: "idle",
    error: null,
    remoteParticipants: [],
    muted: false,
    videoMuted: audioOnly,
    localVideoTrack: null,
    localAudioTrack: null,
  });
  const connectionRef = useRef<unknown>(null);
  const roomRef = useRef<unknown>(null);
  const localTracksRef = useRef<unknown[]>([]);
  const onLeftRef = useRef(onLeft);
  onLeftRef.current = onLeft;

  const doDisconnect = useCallback(() => {
    const room = roomRef.current as { leave?: () => void } | null;
    const connection = connectionRef.current as { disconnect?: () => void } | null;
    const localTracks = localTracksRef.current as Array<{ dispose?: () => void }>;
    if (room?.leave) room.leave();
    if (connection?.disconnect) connection.disconnect();
    localTracks.forEach((t) => t.dispose?.());
    localTracksRef.current = [];
    roomRef.current = null;
    connectionRef.current = null;
    setState((s) => ({ ...s, status: "left", remoteParticipants: [] }));
  }, []);

  const leave = useCallback(() => {
    doDisconnect();
    onLeftRef.current?.();
  }, [doDisconnect]);

  const setMuted = useCallback((muted: boolean) => {
    const localTracks = localTracksRef.current as Array<{ type?: string; setMuted?: (m: boolean) => void }>;
    localTracks.forEach((t) => {
      if (t.type === "audio" && t.setMuted) t.setMuted(muted);
    });
    setState((s) => ({ ...s, muted }));
  }, []);

  const setVideoMuted = useCallback((videoMuted: boolean) => {
    const localTracks = localTracksRef.current as Array<{ type?: string; setMuted?: (m: boolean) => void }>;
    localTracks.forEach((t) => {
      if (t.type === "video" && t.setMuted) t.setMuted(videoMuted);
    });
    setState((s) => ({ ...s, videoMuted }));
  }, []);

  useEffect(() => {
    if (!roomId || typeof window === "undefined") return;

    let cancelled = false;
    const JitsiMeetJS = (window as unknown as { JitsiMeetJS?: unknown }).JitsiMeetJS;
    if (!JitsiMeetJS) {
      setState((s) => ({ ...s, status: "error", error: "Jitsi biblioteca nu e încărcată." }));
      return;
    }

    setState((s) => ({ ...s, status: "connecting", error: null }));

    const init = async () => {
      const J = JitsiMeetJS as {
        init: (opts?: { disableAudioLevels?: boolean }) => void;
        JitsiConnection: new (appId: string | null, token: string | null, opts: Record<string, unknown>) => {
          connect: () => void;
          disconnect: () => void;
          initJitsiConference: (name: string, opts: Record<string, unknown>) => unknown;
          addEventListener: (ev: string, fn: () => void) => void;
        };
        createLocalTracks: (opts?: { devices?: string[]; cameraDeviceId?: string; micDeviceId?: string }) => Promise<unknown[]>;
        events: {
          connection: { CONNECTION_ESTABLISHED: string; CONNECTION_FAILED: string; CONNECTION_DISCONNECTED: string };
          conference: {
            TRACK_ADDED: string;
            TRACK_REMOVED: string;
            CONFERENCE_JOINED: string;
            USER_JOINED: string;
            USER_LEFT: string;
          };
        };
      };

      try {
        J.init({ disableAudioLevels: true });
      } catch {
        // already inited
      }

      const options = {
        hosts: { domain: JITSI_DOMAIN, muc: `conference.${JITSI_DOMAIN}` },
        serviceUrl: `https://${JITSI_DOMAIN}/http-bind`,
        clientNode: "https://jitsi.org/jitsi-meet",
      };

      const connection = new J.JitsiConnection(null, null, options);
      connectionRef.current = connection;

      connection.addEventListener(J.events.connection.CONNECTION_ESTABLISHED, () => {
        if (cancelled) return;
        const confOpts = {
          startWithAudioMuted: false,
          startWithVideoMuted: audioOnly,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
        };
        const room = connection.initJitsiConference(roomId, confOpts) as {
          join: () => void;
          leave: () => void;
          on: (ev: string, fn: (arg: unknown) => void) => void;
          setDisplayName: (n: string) => void;
          addTrack: (track: unknown) => Promise<unknown>;
          getLocalTrack: (type: string) => unknown;
          removeTrack: (track: unknown) => Promise<unknown>;
        };
        roomRef.current = room;

        room.on(J.events.conference.TRACK_ADDED, (track: unknown) => {
          if (cancelled) return;
          const t = track as { getParticipantId: () => string; type: string; getStream: () => MediaStream; attach: (el: HTMLElement) => void };
          const participantId = t.getParticipantId?.() ?? "";
          setState((prev) => {
            const list = [...prev.remoteParticipants];
            let p = list.find((x) => x.id === participantId);
            if (!p) {
              p = { id: participantId, displayName: participantId, videoTrack: null, audioTrack: null };
              list.push(p);
            }
            if (t.type === "video") p.videoTrack = track;
            else if (t.type === "audio") p.audioTrack = track;
            return { ...prev, remoteParticipants: list };
          });
        });

        room.on(J.events.conference.TRACK_REMOVED, (track: unknown) => {
          if (cancelled) return;
          const t = track as { getParticipantId: () => string; type: string };
          const participantId = t.getParticipantId?.() ?? "";
          setState((prev) => ({
            ...prev,
            remoteParticipants: prev.remoteParticipants.map((p) =>
              p.id === participantId
                ? { ...p, videoTrack: t.type === "video" ? null : p.videoTrack, audioTrack: t.type === "audio" ? null : p.audioTrack }
                : p
            ),
          }));
        });

        room.on(J.events.conference.CONFERENCE_JOINED, () => {
          if (cancelled) return;
          setState((s) => ({ ...s, status: "connected" }));
        });

        room.setDisplayName(displayName || "Utilizator");

        J.createLocalTracks({ devices: audioOnly ? ["audio"] : ["audio", "video"] })
          .then((tracks: unknown[]) => {
            if (cancelled) return;
            localTracksRef.current = tracks;
            const audioTrack = tracks.find((tr: unknown) => (tr as { type: string }).type === "audio");
            const videoTrack = tracks.find((tr: unknown) => (tr as { type: string }).type === "video") as { setMuted?: (m: boolean) => void } | undefined;
            if (audioOnly && videoTrack) videoTrack.setMuted?.(true);
            setState((s) => ({ ...s, localVideoTrack: videoTrack ?? null, localAudioTrack: audioTrack ?? null }));
            return Promise.all(tracks.map((track) => room.addTrack(track)));
          })
          .then(() => {
            if (cancelled) return;
            room.join();
          })
          .catch((err: Error) => {
            if (!cancelled) setState((s) => ({ ...s, status: "error", error: err?.message || "Eroare la crearea track-urilor" }));
          });
      });

      connection.addEventListener(J.events.connection.CONNECTION_FAILED, () => {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: "Conexiune eșuată" }));
      });

      connection.connect();
    };

    init();
    return () => {
      cancelled = true;
      doDisconnect();
    };
  }, [roomId, displayName, audioOnly, doDisconnect]);

  return {
    ...state,
    leave,
    setMuted,
    setVideoMuted,
    localVideoTrack: state.localVideoTrack,
    localAudioTrack: state.localAudioTrack,
  };
}

/** Încarcă scriptul lib-jitsi-meet și returnează când e gata. */
export function loadJitsiScript(domain: string = JITSI_DOMAIN): Promise<void> {
  const win = typeof window !== "undefined" ? (window as unknown as { JitsiMeetJS?: unknown }) : null;
  if (win?.JitsiMeetJS) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://${domain}/libs/lib-jitsi-meet.min.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Nu s-a putut încărca lib-jitsi-meet"));
    document.head.appendChild(script);
  });
}

export { JITSI_DOMAIN };
