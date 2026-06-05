/** Porțiune din răspunsul POST /api/call/ring — fără date sensibile; ajută la diagnostic „nu sună”. */

export type RingNotifySnapshot = {
  prisma: boolean;
  fcm: { server: boolean; calleeDevices: number };
  voip: { server: boolean; calleeDevices: number };
  webPush: { server: boolean; calleeSubscriptions: number };
};

/** Folosit în alte ecrane (ex. chat) care încă afișează hint înainte de navigare. */
export const RING_PUSH_HINT_DELAY_MS = 80;

/** Hint scurt despre push salvat înainte de navigare spre camera de apel (fără pauză pe lista de mesaje). */
export const RING_PUSH_HINT_SESSION_KEY = "align_ring_push_hint";

/** Chei pentru `pages.callRoom.ringPushHint.*` — salvăm cheia în sessionStorage ca să o traducem la deschiderea camerei. */
export const RING_NOTIFY_HINT_KEYS = ["noPushServer", "noCalleeNotif"] as const;
export type RingNotifyHintKey = (typeof RING_NOTIFY_HINT_KEYS)[number];

export function isRingNotifyHintKey(s: string): s is RingNotifyHintKey {
  return (RING_NOTIFY_HINT_KEYS as readonly string[]).includes(s);
}

/**
 * Situație în care apelantul merită un mesaj discret (fără jargon tehnic): lipsă infrastructură push
 * sau destinatar fără dispozitive / abonamente înregistrate — nu despre WebRTC în sine.
 */
export function getRingNotifyHintKey(n: RingNotifySnapshot | null | undefined): RingNotifyHintKey | null {
  if (!n || !n.prisma) return null;
  const hasCallee =
    n.fcm.calleeDevices > 0 || n.voip.calleeDevices > 0 || n.webPush.calleeSubscriptions > 0;
  if (hasCallee) return null;
  const anyServer = n.fcm.server || n.voip.server || n.webPush.server;
  if (!anyServer) return "noPushServer";
  return "noCalleeNotif";
}
