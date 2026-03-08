"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-dark-900 text-gray-100">
      <h1 className="text-xl font-semibold">Ceva nu a mers bine</h1>
      <p className="text-dark-400 text-sm text-center max-w-md">
        A apărut o eroare. Poți reîmprospăta pagina sau reveni la prima pagină.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-medium"
        >
          Încearcă din nou
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-dark-600 text-gray-300 hover:bg-dark-800 text-sm font-medium"
        >
          Pagina principală
        </Link>
      </div>
    </div>
  );
}
