/** Porțiune din răspunsul POST /api/call/ring — fără date sensibile; ajută la diagnostic „nu sună”. */

export type RingNotifySnapshot = {
  prisma: boolean;
  fcm: { server: boolean; calleeDevices: number };
  voip: { server: boolean; calleeDevices: number };
  webPush: { server: boolean; calleeSubscriptions: number };
};

/** Timp scurt ca utilizatorul să vadă avertismentul înainte de navigare către sala de apel. */
export const RING_PUSH_HINT_DELAY_MS = 250;

/**
 * Mesaj scurt: doar despre **push în fundal**, nu despre WebRTC în sine.
 * Apelul audio/video poate merge dacă amândoi au Align deschis (polling / UI), fără FCM.
 */
export function formatRingNotifyHint(n: RingNotifySnapshot | null | undefined): string | null {
  if (!n || !n.prisma) return null;
  const hasCallee =
    n.fcm.calleeDevices > 0 || n.voip.calleeDevices > 0 || n.webPush.calleeSubscriptions > 0;
  if (hasCallee) return null;
  const anyServer = n.fcm.server || n.voip.server || n.webPush.server;
  if (!anyServer) {
    return "Notificări în fundal: pe Vercel nu sunt setate FCM, APNs VoIP sau Web Push — celălalt nu primește alertă dacă nu are Align deschis. Apelul merge în continuare dacă amândoi sunteți în app; configurează push pentru sunat când e în altă aplicație.";
  }
  return "Destinatarul nu are dispozitiv înregistrat pentru notificări — poate să nu vadă apelul cu app în fundal. Cu chat deschis merge fără push. Android: FCM. Browser: notificări + Web Push.";
}
