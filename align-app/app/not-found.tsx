import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl md:text-8xl font-bold text-dark-500 mb-2">404</p>
        <p className="text-xl text-gray-300 mb-8">This page could not be found.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold px-6 py-3 rounded-xl transition text-center"
          >
            Back to home
          </Link>
          <Link
            href="/terms"
            className="border border-dark-600 text-gray-300 hover:bg-dark-800 font-medium px-6 py-3 rounded-xl transition text-center"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="border border-dark-600 text-gray-300 hover:bg-dark-800 font-medium px-6 py-3 rounded-xl transition text-center"
          >
            Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}
