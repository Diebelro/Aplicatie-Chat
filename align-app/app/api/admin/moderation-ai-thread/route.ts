import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaGetUserRole,
  prismaAdminGetLastMessagesBetween,
} from "@/lib/repo-prisma";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rateLimit";
import { isOpenAiModerationConfigured, openAiModerationThreadBrief } from "@/lib/moderationAiReport";

function isAdminRole(role: string | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

async function requireAdmin(request: NextRequest): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Neautorizat." }, { status: 401 }) };
  }
  if (!isPrismaAvailable()) {
    return { ok: false, response: NextResponse.json({ error: "Neautorizat." }, { status: 403 }) };
  }
  const role = await prismaGetUserRole(userId);
  if (!isAdminRole(role)) {
    return { ok: false, response: NextResponse.json({ error: "Acces interzis." }, { status: 403 }) };
  }
  return { ok: true, userId };
}

function buildTranscript(
  msgs: Awaited<ReturnType<typeof prismaAdminGetLastMessagesBetween>>,
  leftId: string
): string {
  return msgs
    .map((m) => {
      const side = m.fromUserId === leftId ? "participant_left" : "participant_right";
      const body =
        m.text.trim().slice(0, 900) ||
        (m.attachmentUrl ? "[fișier / imagine atașată — conținutul nu e descris aici]" : "");
      return `[${m.createdAt.toISOString()}] ${side}: ${body}`;
    })
    .join("\n");
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isOpenAiModerationConfigured()) {
    return NextResponse.json(
      { error: "OpenAI nu e configurat (OPENAI_API_KEY)." },
      { status: 503 }
    );
  }

  const ip = getClientIpForRateLimit(request);
  if (!checkRateLimit(ip, auth.userId, "/api/admin/moderation-ai-thread")) {
    return NextResponse.json({ error: "Prea multe cereri. Încearcă peste un minut." }, { status: 429 });
  }

  let body: { fromUserId?: unknown; toUserId?: unknown; limit?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const fromUserId = typeof body.fromUserId === "string" ? body.fromUserId.trim() : "";
  const toUserId = typeof body.toUserId === "string" ? body.toUserId.trim() : "";
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    return NextResponse.json({ error: "fromUserId și toUserId necesare și distincte." }, { status: 400 });
  }

  const limit = Math.min(60, Math.max(8, Number(body.limit) || 28));

  try {
    const msgs = await prismaAdminGetLastMessagesBetween(fromUserId, toUserId, limit);
    if (msgs.length === 0) {
      return NextResponse.json({
        summary_ro: "Nu există mesaje în acest interval pentru această pereche.",
        concerns: [] as string[],
        severity_hint: "low" as const,
        disclaimer:
          "Rezumat generat doar pentru moderator. Nu se aplică acțiuni automate. participant_left/right = ordine alfabetică după ID utilizator.",
      });
    }

    const [leftId] = [fromUserId, toUserId].sort();
    const transcript = buildTranscript(msgs, leftId);
    const brief = await openAiModerationThreadBrief(transcript);

    return NextResponse.json({
      ...brief,
      disclaimer:
        "Rezumat AI din ultimele mesaje (context). Verifică conversația integrală; participant_left/right sunt pseudonime tehnice, nu nume reale.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
