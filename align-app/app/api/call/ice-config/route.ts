import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const urls = JSON.parse(process.env.NEXT_PUBLIC_TURN_URLS || "[]");
  const realm = process.env.TURN_REALM!;
  const secret = process.env.TURN_STATIC_SECRET!;

  if (!Array.isArray(urls) || urls.length === 0) {
    return new Response(JSON.stringify({ error: "TURN urls missing" }), { status: 500 });
  }
  if (!realm || !secret) {
    return new Response(JSON.stringify({ error: "TURN realm/secret missing" }), { status: 500 });
  }

  const ttlSeconds = 180; // 3 minute
  const username = `${Math.floor(Date.now() / 1000) + ttlSeconds}:align`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");

  const iceServers = [{ urls, username, credential }];

  return new Response(JSON.stringify({ iceServers, ttl: ttlSeconds, realm }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
