"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { formatTpl } from "@/lib/i18n/formatTpl";

function CheckEmailContent() {
  const { tStr } = useI18n();
  const searchParams = useSearchParams();
  const raw = searchParams?.get("email");
  const email = raw ? decodeURIComponent(raw) : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-dark-900">
      <div className="max-w-sm mx-auto px-4 flex flex-col w-full">
        <Link href="/login" className="inline-block text-brand-400 font-bold">
          {tStr("pages.checkEmail.backBrand")}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-4">{tStr("pages.checkEmail.title")}</h1>
        <p className="ui-subtitle text-sm mt-2">
          {email
            ? formatTpl(tStr("pages.checkEmail.sentTo"), { email })
            : tStr("pages.checkEmail.sentGeneric")}
        </p>
        <p className="ui-subtitle text-sm mt-2">
          {tStr("pages.checkEmail.inboxHint")}
        </p>

        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full !h-11 !min-h-[44px] !max-h-[44px] !py-0 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-900 font-medium text-sm transition"
          >
            {tStr("pages.checkEmail.goLogin")}
          </Link>
        </div>

        <p className="mt-6 text-center text-dark-500 text-sm">
          {tStr("pages.checkEmail.backToLoginLead")}{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            {tStr("pages.checkEmail.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function CheckEmailFallback() {
  const { tStr } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 text-dark-400">
      {tStr("pages.signup.loading")}
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<CheckEmailFallback />}>
      <CheckEmailContent />
    </Suspense>
  );
}
