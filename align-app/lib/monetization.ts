/**
 * Monetizare mesaje (paywall). Un singur abonament, un singur plan.
 * Activezi: MESSAGING_PAYWALL_ENABLED=true în env (ex. Vercel).
 */

import { findUserById, isPremium } from "@/lib/store";
import { isPrismaAvailable, prismaIsPremium } from "@/lib/repo-prisma";

const MESSAGING_PAYWALL_ENABLED =
  process.env.MESSAGING_PAYWALL_ENABLED === "true";

/**
 * Utilizatorul are abonament activ (single plan – tot inclus).
 * Stub/conectat la Prisma (PremiumSubscription) sau store (premium_until / premium_permanent).
 * La eroare (ex. DB indisponibil): returnează true (fail open) ca să nu blocheze mesajele.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    if (isPrismaAvailable()) {
      return prismaIsPremium(userId);
    }
    const user = findUserById(userId);
    if (!user) return false;
    return isPremium(user);
  } catch (err) {
    console.error("[monetization] hasActiveSubscription error", err);
    return true;
  }
}

/**
 * Poate trimite mesaje: dacă paywall e OFF → da; dacă e ON → doar cu abonament activ.
 * La eroare: returnează true ca să nu dea 500 pe producție.
 */
export async function canSendMessage(userId: string): Promise<boolean> {
  if (!MESSAGING_PAYWALL_ENABLED) return true;
  try {
    return hasActiveSubscription(userId);
  } catch (err) {
    console.error("[monetization] canSendMessage error", err);
    return true;
  }
}

export const PAYWALL_MESSAGE =
  "Mesajele sunt disponibile cu abonament.";
