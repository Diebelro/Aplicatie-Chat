"use client";

import Link from "next/link";
import { APP_CREDIT } from "@/lib/site";

export default function ContBlocatPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-dark-900">
      <Link href="/" className="text-brand-400 font-bold">
        ← Align
      </Link>
      <h1 className="text-2xl font-semibold text-white mt-8">Cont blocat</h1>
      <p className="text-dark-300 mt-2 text-center max-w-sm">
        Contul tău a fost blocat. Pentru detalii sau contestare, contactează suportul.
      </p>
      <Link
        href="/login"
        className="mt-6 px-4 py-2 rounded-xl bg-dark-700 text-white hover:bg-dark-600"
      >
        Înapoi la login
      </Link>
      <p className="mt-8 text-dark-500 text-xs text-center">{APP_CREDIT}</p>
    </div>
  );
}
