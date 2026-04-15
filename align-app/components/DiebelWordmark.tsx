/**
 * Wordmark „Diebel” — text simplu (fără inimi), culoare teal din paleta `brand`.
 * Font: system-ui (stack-ul sans al aplicației), lizibil pe ecrane mici.
 */
export function DiebelWordmark({
  className = "",
  variant = "header",
}: {
  className?: string;
  /** header: bara de sus app / legal; hero: landing; kicker: deasupra titlului login */
  variant?: "header" | "hero" | "kicker";
}) {
  const root =
    "font-sans font-semibold tracking-tight antialiased text-brand-400 transition-colors duration-150 hover:text-brand-300 group-hover:text-brand-300";
  const byVariant =
    variant === "hero"
      ? "text-[1.25rem] leading-tight sm:text-2xl md:text-[1.75rem]"
      : variant === "kicker"
        ? "text-sm leading-snug font-medium text-brand-400/95"
        : "text-[1.125rem] leading-tight sm:text-xl";
  return <span className={`${root} ${byVariant} ${className}`.trim()}>Diebel</span>;
}
