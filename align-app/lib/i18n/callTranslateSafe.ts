"use client";

import { useMemo } from "react";
import enMessages from "@/messages/en.json";
import { useI18n } from "@/lib/i18n/context";

function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Dacă lipsește cheia în locale + EN, nu lăsăm string gol (evită UI „tăcut”). */
const MISSING_LEAF_FALLBACK = "Unknown error";

export type CallTranslateBundle = {
  tStr: (path: string) => string;
  tArray: (path: string) => string[];
};

export function wrapCallTranslate(
  tStr: (path: string) => string,
  tArray: (path: string) => string[]
): CallTranslateBundle {
  const enRoot = enMessages as unknown;
  return {
    tStr(path: string): string {
      const primary = tStr(path);
      if (primary) return primary;
      const enVal = getByPath(enRoot, path);
      if (typeof enVal === "string" && enVal.length > 0) return enVal;
      return MISSING_LEAF_FALLBACK;
    },
    tArray(path: string): string[] {
      const primary = tArray(path);
      if (primary.length > 0) return primary;
      const enVal = getByPath(enRoot, path);
      if (Array.isArray(enVal)) return enVal.filter((x): x is string => typeof x === "string");
      return [];
    },
  };
}

/**
 * Traduceri pentru `pages.callRoom.*`: locale curent → EN (bundle static) → „Unknown error” dacă lipsește frunza.
 */
export function useCallRoomTranslate(): CallTranslateBundle {
  const { tStr, tArray } = useI18n();
  return useMemo(() => wrapCallTranslate(tStr, tArray), [tStr, tArray]);
}
