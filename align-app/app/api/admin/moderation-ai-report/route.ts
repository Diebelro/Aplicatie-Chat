import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import {
  isPrismaAvailable,
  prismaGetUserRole,
  prismaAdminFetchMessagesForModerationScan,
} from "@/lib/repo-prisma";
import {
  isOpenAiModerationConfigured,
  openAiModerationClassifyBatch,
  deriveAiSeverity,
  type AiModerationFlag,
} from "@/lib/moderationAiReport";

function isAdminRole(role: string | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

async function requireAdmin(request: NextRequest): Promise<
  { ok: true } | { ok: false; response: NextResponse }
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
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ configured: isOpenAiModerationConfigured() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isOpenAiModerationConfigured()) {
    return NextResponse.json(
      {
        error:
          "OpenAI nu e configurat. Adaugă OPENAI_API_KEY în mediul serverului (ex. .env.local).",
        configured: false,
      },
      { status: 503 }
    );
  }

  let body: { limit?: number };
  try {
    body = (await request.json()) as { limit?: number };
  } catch {
    body = {};
  }
  const cap = Math.min(50, Math.max(5, Number(body.limit) || 25));

  try {
    const rows = await prismaAdminFetchMessagesForModerationScan(cap * 2, {
      onlyNonEmptyText: true,
    });
    const slice = rows.slice(0, cap);
    const payload = slice.map((r) => ({ id: r.id, text: r.text }));

    if (payload.length === 0) {
      return NextResponse.json({
        disclaimer:
          "Sugestii AI doar informative. Tu decizi; nu se aplică automat suspendări sau ștergeri.",
        items: [] as unknown[],
      });
    }

    const aiItems = await openAiModerationClassifyBatch(payload);
    const aiById = new Map(aiItems.map((i) => [i.id, i]));

    const items = slice.map((m) => {
      const ai = aiById.get(m.id);
      const aiFlags: AiModerationFlag[] = ai?.flags?.length ? ai.flags : ["none"];
      const aiNoteRo = ai?.note_ro ?? "";
      const aiSeverity = deriveAiSeverity(aiFlags);
      return {
        id: m.id,
        fromUserId: m.fromUserId,
        toUserId: m.toUserId,
        text: m.text,
        attachmentUrl: m.attachmentUrl,
        attachmentContentType: m.attachmentContentType,
        createdAt: m.createdAt.toISOString(),
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        hasAttachment: Boolean(m.attachmentUrl),
        aiFlags,
        aiNoteRo,
        aiSeverity,
      };
    });

    return NextResponse.json({
      disclaimer:
        "Sugestii AI doar informative. Verifică conversația; tu decizi. Nu se aplică automat sancțiuni.",
      items,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare necunoscută";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
