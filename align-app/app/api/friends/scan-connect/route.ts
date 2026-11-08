import { NextRequest, NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/sessionAuth";
import { isPrismaAvailable, prismaScanConnect } from "@/lib/repo-prisma";
import { scanConnect, findUserById } from "@/lib/store";
import { isPlausibleUserId } from "@/lib/scanConnectPayload";

export async function POST(request: NextRequest) {
  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const friendIdRaw = body?.friend_id ?? body?.friendId ?? body?.u;
  if (!friendIdRaw || typeof friendIdRaw !== "string") {
    return NextResponse.json({ error: "Lipsește friend_id." }, { status: 400 });
  }
  const friendId = friendIdRaw.trim();
  if (!isPlausibleUserId(friendId)) {
    return NextResponse.json({ error: "Cod invalid." }, { status: 400 });
  }

  if (isPrismaAvailable()) {
    try {
      const result = await prismaScanConnect(userId, friendId);
      if (!result.ok) {
        if (result.error === "self") {
          return NextResponse.json({ error: "Nu te poți conecta cu tine însuți." }, { status: 400 });
        }
        if (result.error === "not_found") {
          return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
        }
        if (result.error === "banned") {
          return NextResponse.json({ error: "Cont indisponibil." }, { status: 403 });
        }
        if (result.error === "blocked") {
          return NextResponse.json(
            { error: "Acest utilizator nu acceptă cereri de prietenie." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: "Nu s-a putut conecta." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        status: result.status,
        user: {
          id: result.user.id,
          name: result.user.name,
          username: result.user.username,
        },
      });
    } catch (e) {
      console.error("[api/friends/scan-connect] prisma", e);
    }
  }

  if (!findUserById(friendId)) {
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  const result = scanConnect(userId, friendId);
  if (!result.ok) {
    if (result.error === "self") {
      return NextResponse.json({ error: "Nu te poți conecta cu tine însuți." }, { status: 400 });
    }
    if (result.error === "blocked") {
      return NextResponse.json(
        { error: "Acest utilizator nu acceptă cereri de prietenie." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Utilizator negăsit." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    status: result.status,
    user: {
      id: result.user.id,
      name: result.user.name,
      username: result.user.username,
    },
  });
}
