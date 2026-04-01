/**
 * Sunet scurt tip „sonerie” pentru apel primit. Web Audio necesită adesea `resume()` după un gest al utilizatorului.
 */

let audioCtx: AudioContext | null = null;
let loopTimer: number | null = null;

function playBeep(ctx: AudioContext, freq: number, durationSec: number) {
  if (ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ctx.destination);
  const t0 = ctx.currentTime;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.08, t0 + 0.015);
  g.gain.linearRampToValueAtTime(0, t0 + durationSec);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.04);
}

export function stopIncomingRingtone(): void {
  if (loopTimer != null) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  if (audioCtx) {
    try {
      void audioCtx.close();
    } catch {
      /* ignore */
    }
    audioCtx = null;
  }
}

/** Pornește bucla de sonerie. Oprește întotdeauna cu `stopIncomingRingtone` la unmount / dispariție overlay. */
export function startIncomingRingtone(): {
  resume: () => Promise<void>;
  needsUserGesture: boolean;
} {
  stopIncomingRingtone();
  if (typeof window === "undefined") {
    return { resume: async () => {}, needsUserGesture: false };
  }
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    return { resume: async () => {}, needsUserGesture: false };
  }
  const ctx = new AC();
  audioCtx = ctx;

  const pattern = () => {
    playBeep(ctx, 440, 0.2);
    window.setTimeout(() => playBeep(ctx, 480, 0.2), 260);
  };
  pattern();
  loopTimer = window.setInterval(pattern, 1700);

  return {
    resume: async () => {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    },
    needsUserGesture: ctx.state === "suspended",
  };
}
