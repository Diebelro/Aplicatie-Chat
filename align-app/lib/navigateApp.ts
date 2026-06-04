/** Navigare în shell Android WebView — Link/ router uneori nu răspund la tap. */
export function isDiebelAndroidShell(): boolean {
  return typeof navigator !== "undefined" && /DiebelAndroid/i.test(navigator.userAgent);
}

/** Navigare client (fără reload complet) — important pe Android WebView ca să nu „flash-uiască” tab-urile. */
export function navigateApp(path: string): void {
  if (typeof window === "undefined") return;
  const target = path.startsWith("/") ? path : `/${path}`;
  window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
