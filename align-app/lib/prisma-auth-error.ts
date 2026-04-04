import { Prisma } from "@prisma/client";

/**
 * Mesaj sigur pentru log / răspuns API în dev (fără parolă din DATABASE_URL).
 */
export function describePrismaLoginError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return `Prisma init: ${err.errorCode ?? "?"} ${err.message}`;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return `Prisma ${err.code}: ${err.message}`;
  }
  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return `Prisma engine: ${err.message}`;
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return `Prisma unknown: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function shouldExposeAuthDebugDetails(): boolean {
  return process.env.NODE_ENV === "development" || process.env.AUTH_DEBUG === "1";
}
