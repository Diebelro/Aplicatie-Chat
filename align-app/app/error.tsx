"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tStr } = useI18n();
  const tryAgainRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useLayoutEffect(() => {
    tryAgainRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-dark-900 text-gray-100">
      <h1 className="text-xl font-semibold">{tStr("common.shellErrors.boundaryTitle")}</h1>
      <p className="text-dark-400 text-sm text-center max-w-md">
        {tStr("common.shellErrors.boundaryDescription")}
      </p>
      <div className="flex gap-3">
        <button
          ref={tryAgainRef}
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium"
        >
          {tStr("common.shellErrors.tryAgain")}
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-800 text-sm font-medium"
        >
          {tStr("common.shellErrors.backHome")}
        </Link>
      </div>
    </div>
  );
}
