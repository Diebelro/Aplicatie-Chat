import { findUserById } from "@/lib/store";
import { findUserOrPrisma, isPrismaAvailable, prismaUserRowExists } from "@/lib/repo-prisma";

/** Același criteriu ca la /api/call/missed: user Prisma sau rând User sau store în memorie. */
export async function callApiCallerUserExists(userId: string): Promise<boolean> {
  const user = await findUserOrPrisma(userId);
  if (user != null) return true;
  if (isPrismaAvailable()) return prismaUserRowExists(userId);
  return !!findUserById(userId);
}
