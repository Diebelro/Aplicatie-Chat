"use client";

import { useEffect, useState } from "react";

/**
 * Overlay: ascunde placeholder când există track video live (inclusiv muted înainte de RTP).
 * Nu folosim `track.muted` aici — pe receiver mute/unmute poate palpa la pierderi de pachete și
 * face overlay-ul să licăre. Elementul `<video>` rămâne montat; utilizatorul vede negru scurt
 * în loc de flicker. Safari/iOS: playsInline pe `<video>` în CallUI, neschimbat.
 */
function computeHasRenderableVideo(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => t.kind === "video" && t.readyState === "live");
}

export function useRemoteVideoRenderable(stream: MediaStream | null | undefined): boolean {
  const [hasRenderableVideo, setHasRenderableVideo] = useState(() => computeHasRenderableVideo(stream));

  useEffect(() => {
    if (!stream) {
      setHasRenderableVideo(false);
      return;
    }

    type Row = { t: MediaStreamTrack; onEnded: () => void };
    const rows: Row[] = [];

    const sync = () => {
      setHasRenderableVideo(computeHasRenderableVideo(stream));
    };

    const bindVideoTrack = (t: MediaStreamTrack) => {
      if (t.kind !== "video") return;
      const onEnded = () => sync();
      t.addEventListener("ended", onEnded);
      rows.push({ t, onEnded });
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
      }
    };
  }, [stream]);

  return hasRenderableVideo;
}
