/** Liveness pentru Vercel — dacă 404, verifică Root Directory = align-app. */
import { getPublicAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      ok: true,
      t: Date.now(),
      /** Bază URL folosită la linkuri în mail (reset, verificare); trebuie să fie https://chat.diebel.ro în producție. */
      emailBaseUrl: getPublicAppUrl(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
