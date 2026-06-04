import { isDiebelAndroidShell } from "@/lib/navigateApp";

/**
 * Tab/pagină activă pentru heartbeat și polling.
 * În WebView Android, `document.visibilityState` rămâne adesea "hidden"
 * deși app-ul e în față → online nu se actualizează deloc.
 */
export function isPageActive(): boolean {
  if (typeof document === "undefined") return false;
  if (isDiebelAndroidShell()) return true;
  return document.visibilityState === "visible";
}
