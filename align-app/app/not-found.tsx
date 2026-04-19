"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

export default function NotFound() {
  const { tStr } = useI18n();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl md:text-8xl font-bold text-dark-500 mb-2">{tStr("common.shellErrors.notFoundCode")}</p>
        <p className="text-xl text-gray-300 mb-8">{tStr("common.shellErrors.notFoundDescription")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold px-6 py-3 rounded-xl transition text-center"
          >
            {tStr("common.shellErrors.notFoundHome")}
          </Link>
          <Link
            href="/terms"
            className="border border-dark-600 text-gray-300 hover:bg-dark-800 font-medium px-6 py-3 rounded-xl transition text-center"
          >
            {tStr("common.shellErrors.notFoundTerms")}
          </Link>
          <Link
            href="/privacy"
            className="border border-dark-600 text-gray-300 hover:bg-dark-800 font-medium px-6 py-3 rounded-xl transition text-center"
          >
            {tStr("common.shellErrors.notFoundPrivacy")}
          </Link>
        </div>
      </div>
    </div>
  );
}
