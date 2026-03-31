"use client";

import { APP_AUTHOR, APP_CONTACT_EMAIL, APP_CREDIT_LEAD } from "@/lib/site";

const linkClass =
  "underline-offset-2 hover:underline decoration-current/60 cursor-help text-inherit";

/** Numele autorului ca link mailto; la hover, tooltip cu adresa de email. */
export function DiebelAuthorLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={`mailto:${APP_CONTACT_EMAIL}`}
      title={APP_CONTACT_EMAIL}
      className={`${linkClass} ${className}`.trim()}
    >
      {APP_AUTHOR}
    </a>
  );
}

/** Propoziția completă „Aplicația este realizată de Diebel.” cu același comportament la hover pe „Diebel”. */
export function AppCreditLine({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      {APP_CREDIT_LEAD}
      <DiebelAuthorLink />
      .
    </span>
  );
}
