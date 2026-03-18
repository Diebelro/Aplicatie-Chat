/**
 * Atașamente chat: DOAR imagini (jpg/png/webp), max 10MB.
 * Fără PDF, video, zip.
 */

export const CHAT_ATTACHMENT = {
  /** Max 10MB per fișier */
  MAX_BYTES: 10 * 1024 * 1024,
  /** Tipuri MIME permise (allowlist) – doar imagini */
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
};

export type AllowedAttachmentType = (typeof CHAT_ATTACHMENT.ALLOWED_TYPES)[number];

export function isAllowedAttachmentType(type: string): type is AllowedAttachmentType {
  return CHAT_ATTACHMENT.ALLOWED_TYPES.includes(type as AllowedAttachmentType);
}

export function isImageContentType(type: string): boolean {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

export function isPdfContentType(_type: string): boolean {
  return false;
}
