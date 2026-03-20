"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@/lib/store";
import { getStoredUserRaw } from "@/lib/store";
import { canAccessRoom, isConferenceRoomId } from "@/lib/videoCall";
import { displayName } from "@/lib/displayName";
import CallUI from "@/components/CallUI";

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = getStoredUserRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const audioOnly = searchParams.get("audio") === "1";
  const isCaller = searchParams.get("from") === "ring";
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    if (!u) {
      setAllowed(false);
      return;
    }
    setAllowed(canAccessRoom(roomId, u.id));
  }, [roomId]);

  if (allowed === null || user === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-dark-500">Se încarcă...</span>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="py-12 text-center">
        <p className="text-dark-500 mb-4">Nu ai acces la acest apel.</p>
        <Link href="/app/messages" className="text-brand-400 hover:underline">
          Înapoi la mesaje
        </Link>
      </div>
    );
  }

  return (
    <CallUI
      roomId={roomId}
      userId={user.id}
      displayName={displayName((user.username ?? user.name) || "Utilizator")}
      audioOnly={audioOnly}
      isConference={isConferenceRoomId(roomId)}
      isCaller={isCaller}
    />
  );
}
