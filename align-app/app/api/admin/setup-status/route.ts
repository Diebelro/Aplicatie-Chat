import { NextResponse } from "next/server";
import { isPrismaAvailable, prismaHasAnyAdmin } from "@/lib/repo-prisma";

export async function GET() {
  if (!isPrismaAvailable()) return NextResponse.json({ canSetup: false });
  try {
    const hasAdmin = await prismaHasAnyAdmin();
    return NextResponse.json({ canSetup: !hasAdmin });
  } catch {
    return NextResponse.json({ canSetup: false });
  }
}
