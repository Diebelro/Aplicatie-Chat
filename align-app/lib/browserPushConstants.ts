/** După abonare reușită Push API + SW activ, IncomingCall nu mai folosește poll agresiv. */
export const ALIGN_BROWSER_PUSH_READY_KEY = "align_browser_push_ready";

export function isBrowserPushPrimaryPath(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(ALIGN_BROWSER_PUSH_READY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBrowserPushPrimaryPathReady(): void {
  try {
    sessionStorage.setItem(ALIGN_BROWSER_PUSH_READY_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

export function clearBrowserPushPrimaryPath(): void {
  try {
    sessionStorage.removeItem(ALIGN_BROWSER_PUSH_READY_KEY);
  } catch {
    /* ignore */
  }
}
