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

function isOnCallPage(): boolean {
  if (typeof window === "undefined") return false;
  return /\/app\/call\b/i.test(window.location.pathname || "");
}

/** Doar audio remot — NICIODATĂ monitor local (altfel ecou în cască/difuzor). */
export async function resumeAllCallAudio(): Promise<void> {
  if (!isOnCallPage()) return;
  const ctx = getDiebelAudioContext();
  if (ctx && ctx.state !== "closed") {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  if (typeof document === "undefined") return;
  document.querySelectorAll("audio[data-diebel-remote-audio]").forEach((el) => {
    if (!(el instanceof HTMLAudioElement)) return;
    try {
      if (el.dataset.diebelLocalMonitor === "1") return;
      el.muted = false;
      if (el.srcObject) void el.play();
    } catch {
      /* ignore */
    }
  });
}

/** Pe shell Android, WebView blochează adesea audio până la gest / resume repetat. */
export function scheduleAndroidCallAudioResume(): () => void {
  if (!isDiebelAndroidShell() || typeof window === "undefined" || !isOnCallPage()) return () => {};
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
