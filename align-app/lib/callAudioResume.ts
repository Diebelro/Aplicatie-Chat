import { isDiebelAndroidShell } from "@/lib/navigateApp";

declare global {
  interface Window {
    __diebelAudioCtx?: AudioContext;
  }
}

/** Context Web Audio partajat (sonerie + deblocare în WebView Android). */
export function getDiebelAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!window.__diebelAudioCtx || window.__diebelAudioCtx.state === "closed") {
    window.__diebelAudioCtx = new AC();
  }
  return window.__diebelAudioCtx;
}

/** Reia AudioContext + redă elementele audio cu stream (apel WebRTC în WebView). */
export async function resumeAllCallAudio(): Promise<void> {
  const ctx = getDiebelAudioContext();
  if (ctx && ctx.state !== "closed") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio").forEach((el) => {
    try {
      el.muted = false;
      if (el.srcObject) void el.play();
    } catch {
      /* ignore */
    }
  });
}

/** Pe shell Android, WebView blochează adesea audio până la gest / resume repetat. */
export function scheduleAndroidCallAudioResume(): () => void {
  if (!isDiebelAndroidShell() || typeof window === "undefined") return () => {};
  void resumeAllCallAudio();
  const id = window.setInterval(() => {
    void resumeAllCallAudio();
  }, 600);
  const stop = window.setTimeout(() => {
    window.clearInterval(id);
  }, 12_000);
  return () => {
    window.clearInterval(id);
    window.clearTimeout(stop);
  };
}
