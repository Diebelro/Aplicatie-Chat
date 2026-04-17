"use client";

import { useEffect, useState } from "react";

/**
 * Video „real” = track video live cu frame-uri (receiver WebRTC: `muted` până la primul RTP).
 * Safari/iOS: nu schimbăm playsInline/autoplay aici — rămân pe elementul `<video>` din CallUI.
 */
function computeHasRenderableVideo(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  for (const t of stream.getVideoTracks()) {
    if (t.kind !== "video") continue;
    if (t.readyState !== "live") continue;
    if (!t.muted) return true;
  }
  return false;
}

export function useRemoteVideoRenderable(stream: MediaStream | null | undefined): boolean {
  const [hasRenderableVideo, setHasRenderableVideo] = useState(() => computeHasRenderableVideo(stream));

  useEffect(() => {
    if (!stream) {
      setHasRenderableVideo(false);
      return;
    }

    type Row = {
      t: MediaStreamTrack;
      onEnded: () => void;
      onMute: () => void;
      onUnmute: () => void;
    };
    const rows: Row[] = [];

    const sync = () => {
      setHasRenderableVideo(computeHasRenderableVideo(stream));
    };

    const bindVideoTrack = (t: MediaStreamTrack) => {
      if (t.kind !== "video") return;
      const onEnded = () => sync();
      const onMute = () => sync();
      const onUnmute = () => sync();
      t.addEventListener("ended", onEnded);
      t.addEventListener("mute", onMute);
      t.addEventListener("unmute", onUnmute);
      rows.push({ t, onEnded, onMute, onUnmute });
    };

    const onStreamAdd = (ev: MediaStreamTrackEvent) => {
      bindVideoTrack(ev.track);
      sync();
    };

    const onStreamRemove = (ev: MediaStreamTrackEvent) => {
      const t = ev.track;
      const i = rows.findIndex((r) => r.t === t);
      if (i !== -1) {
        const r = rows[i]!;
        r.t.removeEventListener("ended", r.onEnded);
        r.t.removeEventListener("mute", r.onMute);
        r.t.removeEventListener("unmute", r.onUnmute);
        rows.splice(i, 1);
      }
      sync();
    };

    for (const t of stream.getVideoTracks()) bindVideoTrack(t);
    sync();

    stream.addEventListener("addtrack", onStreamAdd);
    stream.addEventListener("removetrack", onStreamRemove);

    return () => {
      stream.removeEventListener("addtrack", onStreamAdd);
      stream.removeEventListener("removetrack", onStreamRemove);
      for (const r of rows) {
        r.t.removeEventListener("ended", r.onEnded);
        r.t.removeEventListener("mute", r.onMute);
        r.t.removeEventListener("unmute", r.onUnmute);
      }
    };
  }, [stream]);

  return hasRenderableVideo;
}
