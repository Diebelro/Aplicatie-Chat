/**
 * Persistare sesiuni în PostgreSQL — necesar pe Vercel (mai multe instanțe, fără memorie partajată).
 */

import { prisma } from "@/lib/db";

export interface SessionRowDTO {
  userId: string;
  deviceId: string;
  expiresAtMs: number;
}

export async function prismaSessionFind(token: string): Promise<SessionRowDTO | null> {
  try {
    const row = await prisma.userSession.findUnique({ where: { token } });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await prisma.userSession.delete({ where: { token } }).catch(() => {});
      return null;
    }
    return {
      userId: row.userId,
      deviceId: row.deviceId,
      expiresAtMs: row.expiresAt.getTime(),
    };
  } catch {
    return null;
  }
}

export async function prismaSessionCreate(data: {
  token: string;
  userId: string;
  deviceId: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.userSession.create({ data });
}

export async function prismaSessionDelete(token: string): Promise<void> {
  await prisma.userSession.deleteMany({ where: { token } });
}

export async function prismaSessionDeleteAllForUser(userId: string): Promise<void> {
  await prisma.userSession.deleteMany({ where: { userId } });
}
