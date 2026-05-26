/**
 * Marcă header: aceeași bulă de mesaj ca iconița aplicației/PWA.
 * Culoare: `currentColor` din părinte (ex. lângă DiebelWordmark).
 */
const MESSAGE_D =
  "M6.1 5.7h11.8A2.9 2.9 0 0 1 20.8 8.6v5.1a2.9 2.9 0 0 1-2.9 2.9h-3.8L12 19.2l-2.1-2.6H6.1a2.9 2.9 0 0 1-2.9-2.9V8.6a2.9 2.9 0 0 1 2.9-2.9Z";

export function DiebelHeaderMark({ className = "" }: { className?: string }) {
  const size = className.trim() ? className.trim() : "h-7 w-7 sm:h-8 sm:w-8";

  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${size}`.trim()} aria-hidden>
      <path
        d={MESSAGE_D}
        fill="currentColor"
        fillOpacity={0.18}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
