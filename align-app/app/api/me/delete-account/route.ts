import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { del } from "@vercel/blob";
import { findUserById, getPasswordHash, deleteUser } from "@/lib/store";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/sessions";
import { isPrismaAvailable, findUserOrPrisma } from "@/lib/repo-prisma";
import { prisma } from "@/lib/db";
import { deleteAllSessionsForUser } from "@/lib/sessions";
import { deleteDevicesForUser } from "@/lib/devices";

function isLikelyVercelBlobUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes("vercel-storage.com");
  } catch {
    return false;
  }
}

function resolveLocalChatDevPathForDelete(attachmentUrl: string): string | null {
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

async function deleteBlobUrlWithProjectTokens(url: string): Promise<void> {
  const tokens = Array.from(
    new Set(
      [process.env.BLOB_READ_WRITE_TOKEN, process.env.BLOB_READ_WRITE_TOKEN_PDF].filter(
        (t): t is string => typeof t === "string" && t.length > 0
      )
    )
  );
  let ok = false;
  for (const token of tokens) {
    try {
      await del(url, { token });
      ok = true;
      break;
    } catch (err) {
      console.error("[delete-account] del blob (try next token)", url, err);
    }
  }
  if (!ok && tokens.length > 0) {
    console.error("[delete-account] del blob failed for all tokens", url);
  }
}

async function deleteUserOwnedStorageMediaBestEffort(userId: string): Promise<void> {
  let profile: { photos: { url: string }[] } | null = null;
  let messages: { attachmentUrl: string | null }[] = [];
  try {
    ;[profile, messages] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: { photos: { select: { url: true } } },
      }),
      prisma.message.findMany({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
          attachmentUrl: { not: null },
        },
        select: { attachmentUrl: true },
      }),
    ]);
  } catch (err) {
    console.error("[delete-account] load media URLs", err);
    return;
  }

  const urls = new Set<string>();
  for (const p of profile?.photos ?? []) {
    const u = p.url?.trim();
    if (u) urls.add(u);
  }
  for (const m of messages) {
    const u = m.attachmentUrl?.trim();
    if (u) urls.add(u);
  }

  for (const raw of urls) {
    const localPath = resolveLocalChatDevPathForDelete(raw);
    if (localPath) {
      try {
        await unlink(localPath);
      } catch (err) {
        console.error("[delete-account] unlink local chat dev file", localPath, err);
      }
      continue;
    }

    if (!isLikelyVercelBlobUrl(raw)) continue;

    await deleteBlobUrlWithProjectTokens(raw);
  }
}

/** Ștergere cont doar la cererea utilizatorului (parolă confirmată). Nicio ștergere automată. */
export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const password = body?.password;
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Introdu parola pentru a confirma ștergerea contului." }, { status: 400 });
  }

  let passwordHash: string | null = null;
  const inStore = findUserById(userId);
  if (inStore) {
    passwordHash = getPasswordHash(userId) ?? null;
  }
  if (!passwordHash && isPrismaAvailable()) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      passwordHash = u?.passwordHash ?? null;
    } catch {
      // ignore
    }
  }

  if (!passwordHash || !verifyPassword(password, passwordHash)) {
    return NextResponse.json({ error: "Parolă incorectă." }, { status: 401 });
  }

  const existsInPrisma = isPrismaAvailable() && (await findUserOrPrisma(userId));
  if (!inStore && !existsInPrisma) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }

  if (existsInPrisma) {
    try {
      await prisma.pendingIncomingCall.deleteMany({
        where: { OR: [{ toUserId: userId }, { fromId: userId }] },
      });
    } catch (err) {
      console.error("[delete-account] pendingIncomingCall.deleteMany", err);
    }

    try {
      await prisma.missedCall.deleteMany({
        where: { OR: [{ toUserId: userId }, { fromId: userId }] },
      });
    } catch (err) {
      console.error("[delete-account] missedCall.deleteMany", err);
    }

    await deleteUserOwnedStorageMediaBestEffort(userId);

    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch {
      return NextResponse.json({ error: "Nu s-a putut șterge contul." }, { status: 500 });
    }
    await deleteAllSessionsForUser(userId);
    deleteDevicesForUser(userId);
  }
  if (inStore) {
    const deleted = deleteUser(userId);
    if (!deleted && !existsInPrisma) {
      return NextResponse.json({ error: "Nu s-a putut șterge contul." }, { status: 500 });
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
