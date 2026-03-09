"use client";

/**
 * Fingerprint simplu pentru rate limiting (nu pentru identificare precisă).
 * Hash djb2 pe userAgent + screen + timezone + language.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  const s = [
    navigator.userAgent,
    navigator.language,
    (navigator.languages ? [...navigator.languages].join(",") : ""),
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? "",
    (navigator as { deviceMemory?: number }).deviceMemory ?? "",
  ].join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
