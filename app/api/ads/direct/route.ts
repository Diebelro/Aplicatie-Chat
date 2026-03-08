import { NextRequest, NextResponse } from "next/server";

/** Reclame directe (campanii proprii). Slot-uri configurate prin env sau JSON. */
const DIRECT_ADS: Record<string, { imageUrl?: string; link?: string; html?: string; alt?: string }> = {
  strip: {
    alt: "Reclamă",
    // imageUrl și link setate din env în producție
  },
  banner: {},
  rectangle: {},
  discrete: {},
};

export async function GET(request: NextRequest) {
  const slot = request.nextUrl.searchParams.get("slot") ?? "strip";
  const ad = DIRECT_ADS[slot] ?? DIRECT_ADS.strip;
  const imageUrl = process.env.NEXT_PUBLIC_AD_DIRECT_IMAGE || ad.imageUrl;
  const link = process.env.NEXT_PUBLIC_AD_DIRECT_LINK || ad.link;
  return NextResponse.json({
    imageUrl: imageUrl || null,
    link: link || null,
    html: ad.html || null,
    alt: ad.alt || "Reclamă",
  });
}
