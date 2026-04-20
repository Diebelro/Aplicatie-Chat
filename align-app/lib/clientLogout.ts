import { signOut } from "next-auth/react";
import { getAuthHeaders } from "@/lib/authClient";

async function clearClientSessionAndGoHome(): Promise<void> {
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

/** Închide sesiunea curentă (cookie + token) + NextAuth + storage; apoi redirect la landing. */
export async function performClientLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
  await clearClientSessionAndGoHome();
}

/** Închide toate sesiunile utilizatorului + NextAuth + storage; apoi redirect la landing. */
export async function performClientLogoutAllDevices(): Promise<void> {
  try {
    await fetch("/api/auth/logout-all", {
      method: "POST",
      credentials: "include",
      headers: { ...getAuthHeaders() } as Record<string, string>,
    });
  } catch {
    /* ignore */
  }
  await clearClientSessionAndGoHome();
}
