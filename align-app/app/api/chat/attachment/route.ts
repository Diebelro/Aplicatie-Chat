import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaGetMessageById, prismaGetUserRole } from "@/lib/repo-prisma";
import { isImageContentType, isPdfContentType } from "@/lib/chatAttachments";

/**
 * Servire atașamente chat (imagini private, PDF private). Doar participanți sau admin.
 * GET /api/chat/attachment?messageId=...
 */
export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const messageId = request.nextUrl.searchParams.get("messageId");
  if (!messageId) {
    return NextResponse.json({ error: "Lipsește messageId." }, { status: 400 });
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
    const role = await prismaGetUserRole(userId);
    if (role !== "ADMIN" && role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Nu ai acces la acest atașament." }, { status: 403 });
    }
  }

  if (!msg.attachmentUrl || !msg.attachmentContentType) {
    return NextResponse.json({ error: "Mesajul nu are atașament." }, { status: 404 });
  }

  const ct = msg.attachmentContentType;
  const blobUrl = msg.attachmentUrl;

  if (isPdfContentType(ct)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN_PDF;
    if (!token) {
      return NextResponse.json({ error: "Store PDF nu este configurat." }, { status: 503 });
    }
    try {
      const result = await get(blobUrl, { access: "private", token });
      if (result == null || result.statusCode !== 200 || result.stream == null) {
        return NextResponse.json({ error: "Atașament negăsit sau indisponibil." }, { status: 404 });
      }
      return new Response(result.stream, {
        headers: {
          "Content-Type": result.blob.contentType ?? "application/pdf",
          "Content-Disposition": `inline; filename="attachment.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      console.error("[chat/attachment] pdf", err);
      return NextResponse.json({ error: "Eroare la încărcarea atașamentului." }, { status: 500 });
    }
  }

  if (isImageContentType(ct)) {
    const localPath = resolveLocalChatDevPath(blobUrl);
    if (localPath) {
      try {
        const buf = await readFile(localPath);
        return new Response(buf, {
          headers: {
            "Content-Type": ct,
            "Content-Disposition": `inline; filename="image"`,
            "Cache-Control": "private, no-store",
          },
        });
      } catch (err) {
        console.error("[chat/attachment] local file", err);
        return NextResponse.json({ error: "Eroare la citirea fișierului." }, { status: 500 });
      }
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      try {
        const result = await get(blobUrl, { access: "private", token });
        if (result != null && result.statusCode === 200 && result.stream != null) {
          return new Response(result.stream, {
            headers: {
              "Content-Type": result.blob.contentType ?? ct,
              "Content-Disposition": `inline; filename="image"`,
              "Cache-Control": "private, no-store",
            },
          });
        }
      } catch (err) {
        console.warn("[chat/attachment] private blob failed, trying legacy public URL", err);
      }
    }

    try {
      const res = await fetch(blobUrl);
      if (res.ok && res.body) {
        return new Response(res.body, {
          headers: {
            "Content-Type": res.headers.get("content-type") ?? ct,
            "Cache-Control": "private, no-store",
          },
        });
      }
    } catch (err) {
      console.error("[chat/attachment] fetch legacy url", err);
    }

    return NextResponse.json({ error: "Imagine indisponibilă." }, { status: 404 });
  }

  return NextResponse.json({ error: "Tip atașament nesuportat." }, { status: 400 });
}

/** Dev: fișiere în public/_chatDev — path sigur pe disc. */
function resolveLocalChatDevPath(attachmentUrl: string): string | null {
  try {
    const pathname = attachmentUrl.startsWith("http")
      ? new URL(attachmentUrl).pathname
      : attachmentUrl.split("?")[0];
    const idx = pathname.indexOf("/_chatDev/");
    if (idx === -1) return null;
    const rel = pathname.slice(idx + "/_chatDev/".length);
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) return null;
    const full = path.join(process.cwd(), "public", "_chatDev", rel);
    const base = path.resolve(process.cwd(), "public", "_chatDev");
    const resolved = path.resolve(full);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) return null;
    if (!existsSync(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}
