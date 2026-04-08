/** Porțiune din răspunsul POST /api/call/ring — fără date sensibile; ajută la diagnostic „nu sună”. */

export type RingNotifySnapshot = {
  prisma: boolean;
  fcm: { server: boolean; calleeDevices: number };
  voip: { server: boolean; calleeDevices: number };
  webPush: { server: boolean; calleeSubscriptions: number };
};

/** Mesaj scurt pentru UI dacă notificările către destinatar probabil lipsesc. */
export function formatRingNotifyHint(n: RingNotifySnapshot | null | undefined): string | null {
  if (!n || !n.prisma) return null;
  const hasCallee =
    n.fcm.calleeDevices > 0 || n.voip.calleeDevices > 0 || n.webPush.calleeSubscriptions > 0;
  if (hasCallee) return null;
  const anyServer = n.fcm.server || n.voip.server || n.webPush.server;
  if (!anyServer) {
    return "Serverul nu are configurate FCM (Android), APNs VoIP (iOS) sau Web Push (browser) — nimeni nu primește „apel primit” în fundal. Verifică variabilele de mediu pe Vercel.";
  }
  return "Destinatarul nu are niciun dispozitiv înregistrat pentru notificări. Pe Android: Align → Înregistrează FCM. În browser: permite notificările pentru site. Dacă destinatarul are deja deschis Align în conversație, poate vedea apelul fără push.";
}
