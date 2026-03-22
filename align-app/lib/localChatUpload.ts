/**
 * Fallback dev: imagini chat salvate pe disc (public/_chatDev) când lipsește Vercel Blob.
 * Pe Vercel (VERCEL=1) nu se folosește — acolo e obligatoriu BLOB_READ_WRITE_TOKEN.
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";

export function isBlobStorageConfigured(): boolean {
  return !!(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_PDF
  );
}

/**
 * True dacă putem salva imagini local (npm run dev pe mașina ta, fără deploy Vercel).
 */
export function canSaveChatImagesToLocalDisk(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.CHAT_LOCAL_UPLOAD === "false") return false;
  if (process.env.CHAT_LOCAL_UPLOAD === "true") return true;
  return process.env.NODE_ENV === "development";
}

/** Upload „configurat” pentru UI: Blob sau disc local (doar imagini). */
export function isChatUploadConfiguredForClient(): boolean {
  return isBlobStorageConfigured() || canSaveChatImagesToLocalDisk();
}

const PUBLIC_SUBDIR = "_chatDev";

export async function saveLocalChatImage(
  userId: string,
  buf: Buffer,
  contentType: string
): Promise<{ publicUrlPath: string }> {
  const ext =
    contentType === "image/jpeg"
      ? "jpg"
      : contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "bin";
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "user";
  const filename = `${safeUser}-${id}.${ext}`;
  const dir = path.join(process.cwd(), "public", PUBLIC_SUBDIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);
  return { publicUrlPath: `/${PUBLIC_SUBDIR}/${filename}` };
}
