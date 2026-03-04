"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ? decodeURIComponent(searchParams.get("email")!) : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <Link href="/login" className="inline-block text-brand-400 font-bold">
          ← Align
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-4">Verifică emailul</h1>
        <p className="text-sm text-dark-300 mt-2">
          {email
            ? `Am trimis un link de verificare la ${email}.`
            : "Am trimis un link de verificare la adresa ta de email."}
        </p>
        <p className="text-sm text-dark-300 mt-2">
          Deschide linkul din email pentru a confirma contul. Verifică și dosarul de spam.
        </p>

        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
          >
            Mergi la Log in
          </Link>
        </div>

        <p className="mt-6 text-center text-dark-500 text-sm">
          Înapoi la{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
