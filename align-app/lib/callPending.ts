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

export type PendingIncomingPayload = { fromId: string; roomId: string; audioOnly: boolean };

export async function getPendingIncomingForCallee(toUserId: string): Promise<PendingIncomingPayload | null> {
  if (isPrismaAvailable()) {
    const db = await prismaGetPendingIncomingCall(toUserId);
    if (db) return db;
  }
  const m = getPendingCall(toUserId);
  return m ? { fromId: m.fromId, roomId: m.roomId, audioOnly: m.audioOnly } : null;
}

export async function clearPendingIncomingForCallee(toUserId: string): Promise<void> {
  clearPendingCall(toUserId);
  if (isPrismaAvailable()) await prismaDeletePendingIncomingCall(toUserId);
}

/** Orice parte a apelului închide — golește inelul pentru acel room (callee nu mai vede apel fictiv). */
export async function clearPendingIncomingForRoom(roomId: string): Promise<void> {
  const { clearPendingCallByRoomId } = await import("@/lib/store");
  clearPendingCallByRoomId(roomId);
  if (isPrismaAvailable()) await prismaDeletePendingIncomingByRoomId(roomId);
}
