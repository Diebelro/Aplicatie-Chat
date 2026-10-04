/** Navigare în shell Android WebView — Link/ router uneori nu răspund la tap. */
export function isDiebelAndroidShell(): boolean {
  return typeof navigator !== "undefined" && /DiebelAndroid/i.test(navigator.userAgent);
}

/**
 * Orice shell nativ (Android WebView sau iOS WKWebView) — ambele adaugă sufix în UA.
 * Atenție: pentru `isPageActive` rămâne doar Android; pe iOS `visibilityState` e corect,
 * iar forțarea „activ" ar ține utilizatorul online și cu aplicația în fundal.
 */
export function isDiebelNativeShell(): boolean {
  return typeof navigator !== "undefined" && /Diebel(Android|IOS)/i.test(navigator.userAgent);
}

/** Navigare client (fără reload complet) — important pe Android WebView ca să nu „flash-uiască” tab-urile. */
export function navigateApp(path: string): void {
  if (typeof window === "undefined") return;
  const target = path.startsWith("/") ? path : `/${path}`;
  window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
