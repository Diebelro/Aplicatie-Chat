export default function CallLoading() {
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black text-white">
      <div
        className="h-12 w-12 rounded-full border-2 border-white/20 border-t-brand-400 animate-spin"
        aria-label="Se deschide apelul"
        role="status"
      />
    </div>
  );
}
