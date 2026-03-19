import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  CHAT_ATTACHMENT,
  isAllowedAttachmentType,
  isImageContentType,
  isPdfContentType,
} from "@/lib/chatAttachments";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

/** GET: verifică dacă upload-ul (Blob) e configurat – clientul poate ascunde butonul de atașament. */
export async function GET() {
  const configured =
    !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_PDF);
  return NextResponse.json({ configured });
}

/**
 * Upload un singur fișier pentru chat. Imagini (jpeg, png, webp) → public; PDF → private. Max 10MB.
 */
export async function POST(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const tokenImages = process.env.BLOB_READ_WRITE_TOKEN;
  const tokenPdf = process.env.BLOB_READ_WRITE_TOKEN_PDF;
  if (!tokenImages && !tokenPdf) {
    return NextResponse.json(
      { error: "Upload-ul nu este configurat (lipsesc token-uri Blob)." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corp invalid (form-data)." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Lipsește fișierul sau nu este un File." },
      { status: 400 }
    );
  }

  const contentType = (file.type || "").trim().toLowerCase();
  if (!isAllowedAttachmentType(contentType)) {
    return NextResponse.json(
      {
        error:
          "Tip fișier nepermis. Permise: imagini (JPEG, PNG, WebP) și PDF.",
      },
      { status: 400 }
    );
  }

  if (file.size > CHAT_ATTACHMENT.MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Fișierul depășește limita de ${CHAT_ATTACHMENT.MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 400 }
    );
  }

  const isImage = isImageContentType(contentType);
  const isPdf = isPdfContentType(contentType);
  const token = isImage ? tokenImages : isPdf ? tokenPdf : tokenImages;
  if (!token) {
    return NextResponse.json(
      {
        error: isPdf
          ? "Store-ul pentru PDF nu este configurat (BLOB_READ_WRITE_TOKEN_PDF)."
          : "Store-ul pentru imagini nu este configurat.",
      },
      { status: 503 }
    );
  }

  const access = isPdf ? ("private" as const) : ("public" as const);
  const ext = isPdf ? "pdf" : contentType.split("/")[1] || "bin";
  const pathname = `chat/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const blob = await put(pathname, file, {
      access,
      contentType,
      addRandomSuffix: true,
      token,
    });
    return NextResponse.json({
      url: blob.url,
      contentType,
    });
  } catch (err) {
    console.error("[chat/upload]", err);
    return NextResponse.json(
      { error: "Eroare la încărcare. Încearcă din nou." },
      { status: 500 }
    );
  }
}
