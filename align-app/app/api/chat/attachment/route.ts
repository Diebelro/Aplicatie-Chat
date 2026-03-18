import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetMessageById } from "@/lib/repo-prisma";
import { isPdfContentType } from "@/lib/chatAttachments";

/**
 * Servire atașament privat (PDF). Verifică că userul e participant la conversație, apoi stream blob.
 * GET /api/chat/attachment?messageId=...
 */
export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const messageId = request.nextUrl.searchParams.get("messageId");
  if (!messageId) {
    return NextResponse.json(
      { error: "Lipsește messageId." },
      { status: 400 }
    );
  }

  if (!isPrismaAvailable()) {
    return NextResponse.json(
      { error: "Atașamentele private nu sunt disponibile fără DB." },
      { status: 503 }
    );
  }

  const msg = await prismaGetMessageById(messageId);
  if (!msg) {
    return NextResponse.json({ error: "Mesaj negăsit." }, { status: 404 });
  }

  const isParticipant = userId === msg.fromUserId || userId === msg.toUserId;
  if (!isParticipant) {
    return NextResponse.json({ error: "Nu ai acces la acest atașament." }, { status: 403 });
  }

  if (!msg.attachmentUrl || !msg.attachmentContentType) {
    return NextResponse.json({ error: "Mesajul nu are atașament." }, { status: 404 });
  }

  if (!isPdfContentType(msg.attachmentContentType)) {
    return NextResponse.json(
      { error: "Doar PDF-urile private se servesc prin acest endpoint." },
      { status: 400 }
    );
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN_PDF;
  if (!token) {
    return NextResponse.json(
      { error: "Store PDF nu este configurat." },
      { status: 503 }
    );
  }

  try {
    const result = await get(msg.attachmentUrl, {
      access: "private",
      token,
    });
    if (result == null || result.statusCode !== 200 || result.stream == null) {
      return NextResponse.json(
        { error: "Atașament negăsit sau indisponibil." },
        { status: 404 }
      );
    }
    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType ?? "application/pdf",
        "Content-Disposition": `inline; filename="attachment.pdf"`,
      },
    });
  } catch (err) {
    console.error("[chat/attachment]", err);
    return NextResponse.json(
      { error: "Eroare la încărcarea atașamentului." },
      { status: 500 }
    );
  }
}
