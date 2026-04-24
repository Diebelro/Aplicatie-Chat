import { fetchWithAuthRetry } from "@/lib/authClient";

export function dispatchConversationRead(otherId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("align:conversation-read", { detail: { otherId } }));
}

/** Marchează mesajele primite de la otherId ca citite (același contract ca la deschiderea chatului). */
export async function markConversationReadClient(otherId: string): Promise<boolean> {
  const r = await fetchWithAuthRetry("/api/me/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherId }),
  });
  if (r.ok) dispatchConversationRead(otherId);
  return r.ok;
}
