import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";
import { isPrismaAvailable, prismaCreateAppFeedback } from "@/lib/repo-prisma";

const PATH = "/api/feedback";
const MIN_LEN = 8;
const MAX_LEN = 8000;

export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, userId, PATH)) {
    return NextResponse.json({ error: "Prea multe cereri. Încearcă într-un minut." }, { status: 429 });
  }
  if (!isPrismaAvailable()) {
    return NextResponse.json(
      { error: "Feedback-ul nu poate fi salvat momentan. Încearcă mai târziu." },
      { status: 503 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const raw = body?.message;
  const pageUrl = body?.pageUrl;
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "Scrie mesajul tău." }, { status: 400 });
  }
  const message = raw.trim();
  if (message.length < MIN_LEN) {
    return NextResponse.json(
      { error: `Te rugăm să detaliezi puțin (minim ${MIN_LEN} caractere).` },
      { status: 400 }
    );
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: "Mesajul e prea lung." }, { status: 400 });
  }
  let pageUrlNorm: string | null = null;
  if (pageUrl != null && typeof pageUrl === "string") {
    const t = pageUrl.trim().slice(0, 2000);
    if (t.length > 0) pageUrlNorm = t;
  }
  try {
    await prismaCreateAppFeedback(userId, message, pageUrlNorm);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Eroare server." }, { status: 500 });
  }
}
