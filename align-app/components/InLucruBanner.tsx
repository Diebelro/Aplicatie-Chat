const MESSAGE = "Site în lucru — funcționalitățile pot fi modificate.";

/** Banner principal sticky (folosit în root layout) */
export function InLucruBanner() {
  return (
    <div
      className="sticky top-0 z-[9999] w-full text-center py-4 text-xl font-bold shadow-md text-white"
      style={{ backgroundColor: "#b91c1c" }}
    >
      {MESSAGE}
    </div>
  );
}

/** Mic reminder pe pagini (login, signup, home) */
export function InLucruReminder() {
  return (
    <p
      className="text-center py-2 px-3 text-sm font-semibold text-white rounded-md"
      style={{ backgroundColor: "#b91c1c" }}
    >
      {MESSAGE}
    </p>
  );
}
