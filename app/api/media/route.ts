/**
 * Servește imagini și resurse premium doar prin URL-uri semnate și expirabile.
 * GET /api/media?s=TOKEN — TOKEN = signPath(path) cu path de forma user|userId|photoIndex sau premium|assetId
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignedToken } from "@/lib/signedUrls";
import { findUserById } from "@/lib/store";

export async function GET(request: NextRequest) {
  const s = request.nextUrl.searchParams.get("s");
  if (!s) {
    return NextResponse.json({ error: "Lipsește parametrul s (URL semnat)." }, { status: 400 });
  }
  const parsed = verifySignedToken(s);
  if (!parsed) {
    return NextResponse.json({ error: "URL invalid sau expirat." }, { status: 403 });
  }
  const path = parsed.path;
  const parts = path.split("|");
  if (parts[0] === "user" && parts.length >= 3) {
    const userId = parts[1];
    const index = parseInt(parts[2], 10);
    if (Number.isNaN(index) || index < 0) {
      return NextResponse.json({ error: "Index invalid." }, { status: 400 });
    }
    const user = findUserById(userId);
    if (!user || !user.photos || !user.photos[index]) {
      return NextResponse.json({ error: "Resursă negăsită." }, { status: 404 });
    }
    const photo = user.photos[index];
    if (typeof photo !== "string") {
      return NextResponse.json({ error: "Resursă invalidă." }, { status: 400 });
    }
    if (photo.startsWith("data:")) {
      const match = photo.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const base64 = match[2];
        const buf = Buffer.from(base64, "base64");
        return new NextResponse(buf, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=300",
          },
        });
      }
    }
    return NextResponse.json({ error: "Format imagine nesuportat." }, { status: 400 });
  }
  if (parts[0] === "premium" && parts.length >= 2) {
    const assetId = parts[1];
    if (!assetId) return NextResponse.json({ error: "Resursă negăsită." }, { status: 404 });
    return NextResponse.json(
      { error: "Resurse premium: implementare specifică (ex. redirect la CDN semnat)." },
      { status: 501 }
    );
  }
  return NextResponse.json({ error: "Path invalid." }, { status: 400 });
}
