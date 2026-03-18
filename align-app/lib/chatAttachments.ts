/**
 * Atașamente chat: imagini (jpg/png/webp) + PDF, max 10MB.
 * Imagini → Blob public; PDF → Blob private.
 */

export const CHAT_ATTACHMENT = {
  /** Max 10MB per fișier */
  MAX_BYTES: 10 * 1024 * 1024,
  /** Tipuri MIME permise (allowlist) */
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ] as const,
};

export type AllowedAttachmentType = (typeof CHAT_ATTACHMENT.ALLOWED_TYPES)[number];

export function isAllowedAttachmentType(type: string): type is AllowedAttachmentType {
  return CHAT_ATTACHMENT.ALLOWED_TYPES.includes(type as AllowedAttachmentType);
}

export function isImageContentType(type: string): boolean {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

export function isPdfContentType(type: string): boolean {
  return type === "application/pdf";
}
