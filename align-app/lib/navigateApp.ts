/** Navigare în shell Android WebView — Link/ router uneori nu răspund la tap. */
export function isDiebelAndroidShell(): boolean {
  return typeof navigator !== "undefined" && /DiebelAndroid/i.test(navigator.userAgent);
}

export function navigateApp(path: string): void {
  if (typeof window === "undefined") return;
  const target = path.startsWith("/") ? path : `/${path}`;
  if (isDiebelAndroidShell()) {
    window.location.assign(target);
    return;
  }
  window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
