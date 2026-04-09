import type { User } from "@/lib/store";
import { findUserById } from "@/lib/store";
import {
  findUserOrPrisma,
  isPrismaAvailable,
  prismaFindUserByIdForMe,
  prismaUserRowExists,
} from "@/lib/repo-prisma";

/** Același criteriu ca la /api/call/missed: user Prisma sau rând User sau store în memorie. */
export async function callApiCallerUserExists(userId: string): Promise<boolean> {
  const user = await findUserOrPrisma(userId);
  if (user != null) return true;
  if (isPrismaAvailable()) return prismaUserRowExists(userId);
  return !!findUserById(userId);
}

/** Profil pentru ring/push: findUserOrPrisma poate fi null fără Profile, dar User există în DB. */
export async function resolveUserDtoForRing(userId: string): Promise<User | null> {
  const u = await findUserOrPrisma(userId);
  if (u) return u;
  if (isPrismaAvailable()) {
    const me = await prismaFindUserByIdForMe(userId);
    if (me) return me;
  }
  return findUserById(userId) ?? null;
}
