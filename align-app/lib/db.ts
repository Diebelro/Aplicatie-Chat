import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Refolosim același client în același process (obligatoriu pe serverless/Vercel ca să nu explodăm conexiunile la DB).
globalForPrisma.prisma = prisma;
