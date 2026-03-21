import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/store";
import { findUserOrPrisma, prismaUserRowExists, isPrismaAvailable } from "@/lib/repo-prisma";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { clearPendingIncomingForCallee } from "@/lib/callPending";

/** Încheie apelul: curăță apelul în așteptare pentru utilizatorul curent (dacă există). */
export async function POST(request: NextRequest) {
  const userId = resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const okUser =
    (await findUserOrPrisma(userId)) != null ||
    (isPrismaAvailable() ? await prismaUserRowExists(userId) : !!findUserById(userId));
  if (!okUser) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  await clearPendingIncomingForCallee(userId);
  return NextResponse.json({ ok: true });
}
