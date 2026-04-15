/** Porțiune din răspunsul POST /api/call/ring — fără date sensibile; ajută la diagnostic „nu sună”. */

export type RingNotifySnapshot = {
  prisma: boolean;
  fcm: { server: boolean; calleeDevices: number };
  voip: { server: boolean; calleeDevices: number };
  webPush: { server: boolean; calleeSubscriptions: number };
};

/** Folosit în alte ecrane (ex. chat) care încă afișează hint înainte de navigare. */
export const RING_PUSH_HINT_DELAY_MS = 250;

/** Hint scurt despre push salvat înainte de navigare spre camera de apel (fără pauză pe lista de mesaje). */
export const RING_PUSH_HINT_SESSION_KEY = "align_ring_push_hint";

/**
 * Mesaj scurt: doar despre **push în fundal**, nu despre WebRTC în sine.
 * Apelul audio/video poate merge dacă amândoi au Diebel deschis (polling / UI), fără FCM.
 */
export function formatRingNotifyHint(n: RingNotifySnapshot | null | undefined): string | null {
  if (!n || !n.prisma) return null;
  const hasCallee =
    n.fcm.calleeDevices > 0 || n.voip.calleeDevices > 0 || n.webPush.calleeSubscriptions > 0;
  if (hasCallee) return null;
  const anyServer = n.fcm.server || n.voip.server || n.webPush.server;
  if (!anyServer) {
    return "Fără push configurat pe server, celălalt poate să nu primească alertă în fundal. Cu aplicația deschisă, apelul merge.";
  }
  return "Destinatarul nu are notificări înregistrate — cu app în fundal poate să nu vadă apelul. Cu chat deschis merge.";
}
