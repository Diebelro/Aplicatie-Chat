import { NextRequest, NextResponse } from "next/server";
import { findUserById, isPremium, getRewardedState } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, findUserOrPrisma, prismaIsPremium } from "@/lib/repo-prisma";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  if (isPrismaAvailable()) {
    try {
      const user = await findUserOrPrisma(userId);
      if (!user) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      const premium = await prismaIsPremium(userId);
      const premiumUntil = user.premium_until != null && user.premium_until > Date.now() ? user.premium_until : null;
      return NextResponse.json({
        premium,
        premiumUntil,
        permanent: user.premium_permanent === true,
        rewardedActivationsToday: 0,
        rewardedActivationsMax: 3,
        canActivateRewarded: !premium,
      });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const rewarded = getRewardedState(userId);
  const premium = isPremium(user);
  const premiumUntil = user.premium_until != null && user.premium_until > Date.now() ? user.premium_until : null;
  return NextResponse.json({
    premium,
    premiumUntil,
    permanent: user.premium_permanent === true,
    rewardedActivationsToday: rewarded?.activationsToday ?? 0,
    rewardedActivationsMax: rewarded?.maxPerDay ?? 3,
    canActivateRewarded: rewarded?.canActivate ?? false,
  });
}
