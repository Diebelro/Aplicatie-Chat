import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import {
  CHAT_ATTACHMENT,
  isAllowedAttachmentType,
  isImageContentType,
  isPdfContentType,
} from "@/lib/chatAttachments";
import {
  canSaveChatImagesToLocalDisk,
  isBlobStorageConfigured,
  isChatUploadConfiguredForClient,
  saveLocalChatImage,
} from "@/lib/localChatUpload";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";

/** GET: Blob sau (dev) salvare locală pentru imagini. */
export async function GET() {
  return NextResponse.json({
    configured: isChatUploadConfiguredForClient(),
    localImagesOnly:
      !isBlobStorageConfigured() && canSaveChatImagesToLocalDisk(),
  });
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

  if (isPdf) {
    if (!tokenPdf) {
      return NextResponse.json(
        {
          error:
            "PDF în chat pe server necesită BLOB_READ_WRITE_TOKEN_PDF (Vercel Blob). În dev poți trimite imagini fără Blob (salvare locală).",
        },
        { status: 503 }
      );
    }
    const pathname = `chat/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
    try {
      const blob = await put(pathname, file, {
        access: "private",
        contentType,
        addRandomSuffix: true,
        token: tokenPdf,
      });
      return NextResponse.json({ url: blob.url, contentType });
    } catch (err) {
      console.error("[chat/upload] pdf blob", err);
      return NextResponse.json(
        { error: "Eroare la încărcare. Încearcă din nou." },
        { status: 500 }
      );
    }
  }

  if (isImage) {
    if (tokenImages) {
      const ext = contentType.split("/")[1] || "bin";
      const pathname = `chat/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      try {
        const blob = await put(pathname, file, {
          access: "public",
          contentType,
          addRandomSuffix: true,
          token: tokenImages,
        });
        return NextResponse.json({ url: blob.url, contentType });
      } catch (err) {
        console.error("[chat/upload] image blob", err);
        return NextResponse.json(
          { error: "Eroare la încărcare. Încearcă din nou." },
          { status: 500 }
        );
      }
    }
    if (canSaveChatImagesToLocalDisk()) {
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const { publicUrlPath } = await saveLocalChatImage(userId, buf, contentType);
        const origin =
          request.nextUrl.origin ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3005";
        const base = origin.replace(/\/$/, "");
        return NextResponse.json({
          url: `${base}${publicUrlPath}`,
          contentType,
        });
      } catch (err) {
        console.error("[chat/upload] local image", err);
        return NextResponse.json(
          { error: "Eroare la salvare locală. Încearcă din nou." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json(
      {
        error:
          "Imaginile în chat pe acest mediu necesită BLOB_READ_WRITE_TOKEN sau rulezi npm run dev local (salvare automată în public/_chatDev).",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: "Tip fișier neacceptat." }, { status: 400 });
}
