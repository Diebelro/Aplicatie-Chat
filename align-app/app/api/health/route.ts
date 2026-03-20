/** Liveness pentru Vercel — dacă 404, verifică Root Directory = align-app. */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { ok: true, t: Date.now() },
    { headers: { "cache-control": "no-store" } }
  );
}
