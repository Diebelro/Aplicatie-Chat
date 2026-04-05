/**
 * Logica comună: când un mesaj are atașament (imagine sau PDF), clienții folosesc
 * doar URL-ul proxy /api/chat/attachment?messageId=… astfel încât blob-urile private
 * să nu fie deschise direct fără verificare participant/admin.
 */

import { isImageContentType, isPdfContentType, isVideoContentType } from "@/lib/chatAttachments";

export function messageAttachmentProxyPath(messageId: string): string {
  return `/api/chat/attachment?messageId=${encodeURIComponent(messageId)}`;
}

/** True dacă atașamentul trebuie servit doar prin proxy (nu URL brut către client). */
export function shouldProxyChatAttachment(
  attachmentUrl: string | null | undefined,
  attachmentContentType: string | null | undefined
): boolean {
  if (!attachmentUrl || !attachmentContentType) return false;
  return (
    isImageContentType(attachmentContentType) ||
    isPdfContentType(attachmentContentType) ||
    isVideoContentType(attachmentContentType)
  );
}

export function toClientMessageAttachmentFields(m: {
  id: string;
  attachmentUrl?: string | null;
  attachmentContentType?: string | null;
}): { attachmentUrl: string | null; attachmentContentType: string | null } {
  const ct = m.attachmentContentType ?? null;
  const url = m.attachmentUrl ?? null;
  if (shouldProxyChatAttachment(url, ct)) {
    return {
      attachmentUrl: messageAttachmentProxyPath(m.id),
      attachmentContentType: ct,
    };
  }
  return { attachmentUrl: url, attachmentContentType: ct };
}
