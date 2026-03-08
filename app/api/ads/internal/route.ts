import { NextRequest, NextResponse } from "next/server";
import { getInternalAdsForCountry } from "@/lib/internalAds";

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country") ?? "";
  const ads = getInternalAdsForCountry(country || undefined);
  return NextResponse.json({ ads });
}
