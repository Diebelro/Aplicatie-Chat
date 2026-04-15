/**
 * Apel în așteptare pentru callee: memorie (dev fără DB) + Prisma (producție / Vercel).
 */
import { getPendingCall, clearPendingCall } from "@/lib/store";
import {
  isPrismaAvailable,
  prismaGetPendingIncomingCall,
  prismaDeletePendingIncomingCall,
  prismaDeletePendingIncomingByRoomId,
} from "@/lib/repo-prisma";

export type PendingIncomingPayload = {
  fromId: string;
  roomId: string;
  audioOnly: boolean;
  /** ISO timestamp — se schimbă la fiecare ring nou (upsert DB); clientul ignoră doar același ring respins. */
  pendingSince: string;
};

export async function getPendingIncomingForCallee(toUserId: string): Promise<PendingIncomingPayload | null> {
  if (isPrismaAvailable()) {
    const db = await prismaGetPendingIncomingCall(toUserId);
    if (db) return db;
  }
  const m = getPendingCall(toUserId);
  return m
    ? { fromId: m.fromId, roomId: m.roomId, audioOnly: m.audioOnly, pendingSince: m.at }
    : null;
}

export async function clearPendingIncomingForCallee(toUserId: string): Promise<void> {
  clearPendingCall(toUserId);
  if (isPrismaAvailable()) await prismaDeletePendingIncomingCall(toUserId);
}

/**
 * Orice parte a apelului închide — golește inelul pentru acel room (callee nu mai vede apel fictiv).
 * `recordMissedIfCaller` + `endedByUserId`: doar dacă cel care a închis e apelantul (fromId), înregistrăm apel pierdut pentru callee (nu la dismiss callee / back).
 */
export async function clearPendingIncomingForRoom(
  roomId: string,
  opts?: { endedByUserId?: string; recordMissedIfCaller?: boolean }
): Promise<void> {
  const { clearPendingCallByRoomId } = await import("@/lib/store");
  const fromId =
    opts?.recordMissedIfCaller && opts?.endedByUserId && !isPrismaAvailable()
      ? opts.endedByUserId
      : undefined;
  clearPendingCallByRoomId(roomId, fromId ? { recordMissedIfFromUserId: fromId } : undefined);
  if (isPrismaAvailable()) await prismaDeletePendingIncomingByRoomId(roomId, opts);
}
