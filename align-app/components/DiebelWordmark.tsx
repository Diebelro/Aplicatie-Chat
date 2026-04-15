import { DiebelHeaderMark } from "@/components/DiebelHeaderMark";

/**
 * Wordmark „Diebel” — text simplu; opțional marcă inimă în stânga (header / hero).
 */
export function DiebelWordmark({
  className = "",
  variant = "header",
  withMark = false,
}: {
  className?: string;
  /** header: bara de sus app / legal; hero: landing; kicker: deasupra titlului login */
  variant?: "header" | "hero" | "kicker";
  /** Logo inimă + text (header app, landing, pagini legale). */
  withMark?: boolean;
}) {
  const root =
    "font-sans font-semibold tracking-tight antialiased text-brand-400 transition-colors duration-150 hover:text-brand-300 group-hover:text-brand-300";
  const byVariant =
    variant === "hero"
      ? "text-[1.25rem] leading-tight sm:text-2xl md:text-[1.75rem]"
      : variant === "kicker"
        ? "text-sm leading-snug font-medium text-brand-400/95"
        : "text-[1.125rem] leading-tight sm:text-xl";

  const text = <span className={`${root} ${byVariant}`.trim()}>Diebel</span>;

  if (withMark && (variant === "header" || variant === "hero" || variant === "kicker")) {
    const markClass =
      variant === "hero"
        ? "h-9 w-9 sm:h-11 sm:w-11"
        : variant === "kicker"
          ? "h-8 w-8 sm:h-9 sm:w-9"
          : "h-7 w-7 sm:h-8 sm:w-8";
    const rowClass =
      variant === "kicker"
        ? `inline-flex min-w-0 w-full flex-wrap items-center justify-center gap-2.5 ${className}`.trim()
        : `inline-flex min-w-0 items-center gap-2.5 ${className}`.trim();
    return (
      <span className={rowClass}>
        <span className="inline-flex shrink-0 text-brand-400 transition-colors duration-150 group-hover:text-brand-300 drop-shadow-[0_0_10px_rgba(244,114,182,0.25)]">
          <DiebelHeaderMark className={markClass} />
        </span>
        {text}
      </span>
    );
  }

  return <span className={`${root} ${byVariant} ${className}`.trim()}>Diebel</span>;
}
