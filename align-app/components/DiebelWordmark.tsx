/**
 * Wordmark minimalist „Diebel” — fără gradient animat, fără iconițe.
 * Folosit în header / login / pagini legale.
 */
export function DiebelWordmark({
  className = "",
  variant = "header",
}: {
  className?: string;
  /** header: nav app/landing; hero: titlu mare landing; kicker: subtitlu login */
  variant?: "header" | "hero" | "kicker";
}) {
  const byVariant =
    variant === "hero"
      ? "text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl"
      : variant === "kicker"
        ? "text-xs font-medium tracking-tight text-zinc-500"
        : "text-lg font-semibold tracking-tight text-zinc-100 sm:text-[1.125rem]";
  return <span className={`${byVariant} ${className}`.trim()}>Diebel</span>;
}
