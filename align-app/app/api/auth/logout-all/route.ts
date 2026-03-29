import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessionAuth";
import { deleteAllSessionsForUser } from "@/lib/sessions";
import { setAllDevicesUntrusted } from "@/lib/devices";
import { SESSION_COOKIE } from "@/lib/sessions";

/** Șterge toate sesiunile userului, setează trusted=false pe toate device-urile, șterge cookie-ul. */
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  await deleteAllSessionsForUser(userId);
  setAllDevicesUntrusted(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
