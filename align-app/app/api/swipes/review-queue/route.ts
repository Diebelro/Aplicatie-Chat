import { NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaListSwipedProfilesForReview } from "@/lib/repo-prisma";
import { findUserById, listMySwipeTargetsForReview } from "@/lib/store";

/**
 * Profiluri pe care utilizatorul le-a swipe-uit (like sau pass), pentru recenzare.
 * Doar vizualizarea listei / parcurgerea nu modifică nimic; schimbarea se face prin POST /api/swipe.
 */
export async function GET(request: Request) {
  const userId = resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  if (isPrismaAvailable()) {
    try {
      const profiles = await prismaListSwipedProfilesForReview(userId);
      return NextResponse.json({ profiles });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }

  const rows = listMySwipeTargetsForReview(userId);
  const profiles = rows
    .map((r) => {
      const u = findUserById(r.toId);
      return u ? { ...u, mySwipeLiked: r.liked } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return NextResponse.json({ profiles });
}
