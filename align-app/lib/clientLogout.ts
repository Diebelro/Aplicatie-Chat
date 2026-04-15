import { signOut } from "next-auth/react";

/** Închide sesiunea Align + NextAuth și golește storage-ul client; apoi navigare hard la landing. */
export async function performClientLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
  try {
    await signOut({ redirect: false });
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return;
  localStorage.removeItem("align_user");
  sessionStorage.removeItem("align_user");
  localStorage.removeItem("align_session_token");
  localStorage.removeItem("align_device_id");
  localStorage.removeItem("align_device_fingerprint");
  sessionStorage.removeItem("align_session_token");
  sessionStorage.removeItem("align_device_id");
  sessionStorage.removeItem("align_device_fingerprint");
  localStorage.removeItem("align_last_email");
  sessionStorage.removeItem("align_last_email");
  ["username", "identifier", "align_username", "align_identifier"].forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  window.location.assign("/");
}
