"use client";

/**
 * Watermark invizibil în UI: hash unic per build + identificator pentru protecție legală.
 * Nu este vizibil în mod normal; folosit pentru audit și identificare în caz de abuz.
 */

import { useEffect, useState } from "react";
import { getStoredUserRaw } from "@/lib/store";

const WATERMARK_ID = "align-legal-wm";

function getBuildHash(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_BUILD_HASH as string) || "";
}

export function Watermark() {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const buildHash = getBuildHash();
      const raw = getStoredUserRaw();
      const uid = raw ? (JSON.parse(raw) as { id?: string })?.id : null;
      const ts = new Date().toISOString().slice(0, 10);
      const parts = [buildHash, uid || "anon", ts].filter(Boolean);
      setValue(parts.join("-"));
    } catch {
      setValue([getBuildHash(), "anon", new Date().toISOString().slice(0, 10)].filter(Boolean).join("-"));
    }
  }, []);
  if (!value) return null;
  return (
    <div
      id={WATERMARK_ID}
      aria-hidden="true"
      data-watermark={value}
      data-build={getBuildHash()}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
        userSelect: "none",
        overflow: "hidden",
        zIndex: -1,
      }}
      suppressHydrationWarning
    >
      {value}
    </div>
  );
}
