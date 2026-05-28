/**
 * Sunet scurt tip „sonerie” pentru apel primit. Web Audio necesită adesea `resume()` după un gest al utilizatorului.
 */

import { getDiebelAudioContext, resumeAllCallAudio, scheduleAndroidCallAudioResume } from "@/lib/callAudioResume";
import { isDiebelAndroidShell } from "@/lib/navigateApp";

let audioCtx: AudioContext | null = null;
let androidResumeCleanup: (() => void) | null = null;
let loopTimer: number | null = null;
let activeToken = 0;
const pendingBeeps = new Set<number>();
const STOP_SIGNAL_KEY = "diebel_stop_incoming_ringtone_v1";
let storageListenerInstalled = false;

function installStorageStopListener(): void {
  if (storageListenerInstalled || typeof window === "undefined") return;
  storageListenerInstalled = true;
  window.addEventListener("storage", (event) => {
    if (event.key === STOP_SIGNAL_KEY) stopIncomingRingtone({ broadcast: false });
  });
}

function clearPendingBeeps(): void {
  if (typeof window !== "undefined") {
    for (const id of pendingBeeps) window.clearTimeout(id);
  }
  pendingBeeps.clear();
}

function scheduleBeep(fn: () => void, ms: number): void {
  if (typeof window === "undefined") return;
  const id = window.setTimeout(() => {
    pendingBeeps.delete(id);
    fn();
  }, ms);
  pendingBeeps.add(id);
}

function playBeep(ctx: AudioContext, token: number, freq: number, durationSec: number) {
  if (token !== activeToken || audioCtx !== ctx) return;
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

export function stopIncomingRingtone(options: { broadcast?: boolean } = {}): void {
  const broadcast = options.broadcast ?? true;
  androidResumeCleanup?.();
  androidResumeCleanup = null;
  activeToken += 1;
  clearPendingBeeps();
  if (loopTimer != null) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  if (audioCtx) {
    const ctx = audioCtx;
    audioCtx = null;
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
  }
  if (broadcast && typeof window !== "undefined") {
    try {
      localStorage.setItem(STOP_SIGNAL_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
}

/** Pornește bucla de sonerie. Oprește întotdeauna cu `stopIncomingRingtone` la unmount / dispariție overlay. */
export function startIncomingRingtone(): {
  resume: () => Promise<void>;
  needsUserGesture: boolean;
} {
  installStorageStopListener();
  stopIncomingRingtone({ broadcast: false });
  if (typeof window === "undefined") {
    return { resume: async () => {}, needsUserGesture: false };
  }
  const ctx = getDiebelAudioContext();
  if (!ctx) {
    return { resume: async () => {}, needsUserGesture: false };
  }
  audioCtx = ctx;
  if (isDiebelAndroidShell()) {
    androidResumeCleanup?.();
    androidResumeCleanup = scheduleAndroidCallAudioResume();
  }
  activeToken += 1;
  const token = activeToken;

  const pattern = () => {
    playBeep(ctx, token, 440, 0.2);
    scheduleBeep(() => playBeep(ctx, token, 480, 0.2), 260);
  };
  pattern();
  loopTimer = window.setInterval(pattern, 1700);

  return {
    resume: async () => {
      await resumeAllCallAudio();
    },
    needsUserGesture: isDiebelAndroidShell() || ctx.state === "suspended",
  };
}
