import { NextRequest, NextResponse } from "next/server";
import { findUserById, setUserLocation } from "@/lib/store";
import { isPrismaAvailable, findUserOrPrisma, prismaUpsertLocation, prismaDeleteLocation } from "@/lib/repo-prisma";

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const location_enabled = body.location_enabled === true;
  const latitude = body.latitude != null ? Number(body.latitude) : null;
  const longitude = body.longitude != null ? Number(body.longitude) : null;

  if (location_enabled && (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude))) {
    return NextResponse.json(
      { error: "Lipsesc latitude si longitude." },
      { status: 400 }
    );
  }

  if (isPrismaAvailable()) {
    try {
      const me = await findUserOrPrisma(userId);
      if (!me) {
        return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
      }
      if (location_enabled && latitude != null && longitude != null) {
        await prismaUpsertLocation(userId, latitude, longitude);
      } else {
        await prismaDeleteLocation(userId);
      }
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Eroare server." }, { status: 500 });
    }
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  setUserLocation(
    userId,
    location_enabled && latitude != null && longitude != null ? latitude : null,
    location_enabled && latitude != null && longitude != null ? longitude : null,
    location_enabled
  );
  return NextResponse.json({ ok: true });
}
