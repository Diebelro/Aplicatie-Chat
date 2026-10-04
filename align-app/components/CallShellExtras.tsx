"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { readActiveConnectedCall } from "@/lib/callAbandonOnLeave";
import { stopIncomingRingtone } from "@/lib/callRingtone";
import { useCallRoomTranslate } from "@/lib/i18n/callTranslateSafe";

/**
 * Oprește soneria la navigare în app + curăță apelul abandonat (sună fără să fii pe ecranul de apel).
 * Bara „Înapoi la apel” apare când ai avut apel conectat și ai ieșit din cameră fără Închide.
 */
export function CallShellExtras() {
  const pathname = usePathname();
  const callT = useCallRoomTranslate();
  const onCallPage = pathname?.startsWith("/app/call") ?? false;
  const prevOnCallPageRef = useRef(onCallPage);
  const [returnRoomId, setReturnRoomId] = useState<string | null>(null);

  useEffect(() => {
    const wasOnCall = prevOnCallPageRef.current;
    prevOnCallPageRef.current = onCallPage;

    if (!onCallPage) {
      stopIncomingRingtone();
    } else if (!wasOnCall && onCallPage) {
      stopIncomingRingtone();
    }

    setReturnRoomId(!onCallPage ? readActiveConnectedCall() : null);
  }, [onCallPage, pathname]);

  useEffect(() => {
    const sync = () => setReturnRoomId(!onCallPage ? readActiveConnectedCall() : null);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [onCallPage]);

  if (!returnRoomId || onCallPage) return null;

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[210] -translate-x-1/2 px-3 w-full max-w-md pointer-events-none">
      <Link
        href={`/app/call/${returnRoomId}`}
        className="pointer-events-auto flex items-center justify-center gap-2 rounded-full bg-green-600/95 text-white font-medium text-sm py-3 px-5 shadow-lg shadow-black/30 border border-white/10 hover:bg-green-500 transition"
      >
        <Phone className="w-4 h-4 shrink-0" aria-hidden />
        {callT.tStr("pages.callRoom.shellExtras.returnToCall")}
      </Link>
    </div>
  );
}
