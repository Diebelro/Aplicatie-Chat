"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getConferenceRoomId } from "@/lib/videoCall";

/** Redirecționează la o cameră de conferință nouă. */
export default function StartConferencePage() {
  const router = useRouter();
  useEffect(() => {
    const roomId = getConferenceRoomId();
    router.replace(`/app/call/${roomId}`);
  }, [router]);
  return (
    <div className="flex items-center justify-center py-20">
      <span className="text-dark-500">Pornire conferință…</span>
    </div>
  );
}
