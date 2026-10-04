/**
 * Atașamente chat: imagini + PDF + video scurt (mp4/webm), max 25MB.
 * Fișierele private se servesc prin /api/chat/attachment.
 */

export const CHAT_ATTACHMENT = {
  /** Max 25MB (video scurt pe mobil) */
  MAX_BYTES: 25 * 1024 * 1024,
  /** Tipuri MIME permise (allowlist) */
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ] as const,
};

export type AllowedAttachmentType = (typeof CHAT_ATTACHMENT.ALLOWED_TYPES)[number];

export function isAllowedAttachmentType(type: string): type is AllowedAttachmentType {
  return CHAT_ATTACHMENT.ALLOWED_TYPES.includes(type as AllowedAttachmentType);
}

const EXTENSION_TO_MIME: Record<string, AllowedAttachmentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/** WebView Android poate trimite `file.type` gol — deducem din extensie. */
export function resolveAttachmentContentType(file: File): string {
  const declared = (file.type || "").trim().toLowerCase();
  if (declared && isAllowedAttachmentType(declared)) return declared;
  const name = (file.name || "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return declared;
  const ext = name.slice(dot + 1);
  return EXTENSION_TO_MIME[ext] ?? declared;
}

export function isImageContentType(type: string): boolean {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

export function isPdfContentType(type: string): boolean {
  return type === "application/pdf";
}

export function isVideoContentType(type: string): boolean {
  const t = (type || "").trim().toLowerCase();
  return t === "video/mp4" || t === "video/webm" || t === "video/quicktime";
}
