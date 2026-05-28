"use client";

import { useEffect } from "react";
import { isDiebelAndroidShell } from "@/lib/navigateApp";
import { resumeAllCallAudio, scheduleAndroidCallAudioResume } from "@/lib/callAudioResume";

/** Deblocare audio în WebView Android: sonerie + voce la apel. */
export function AndroidCallAudio() {
  useEffect(() => {
    if (!isDiebelAndroidShell()) return;
    const stopSchedule = scheduleAndroidCallAudioResume();
    const onGesture = () => {
      void resumeAllCallAudio();
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("touchstart", onGesture, { passive: true });
    return () => {
      stopSchedule();
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
  }, []);
  return null;
}
