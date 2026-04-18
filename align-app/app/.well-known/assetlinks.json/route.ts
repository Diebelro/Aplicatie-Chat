import { NextResponse } from "next/server";

/**
 * Digital Asset Links pentru **Trusted Web Activity** (Android / Play).
 * După ce generezi `.aab` (Bubblewrap / PWABuilder), în Play Console → App signing:
 * copiezi **SHA-256 certificate fingerprint** (App signing key) și **package name**.
 * Pe Vercel: `ANDROID_TWA_PACKAGE_NAME` + `ANDROID_TWA_SHA256_FINGERPRINTS` (una sau mai multe, separate prin virgulă).
 *
 * Fără env: răspuns `[]` (valid JSON) — TWA poate afișa bară de URL până completezi verificarea.
 */
function normalizeSha256Fingerprint(raw: string): string | null {
  const hex = raw.replace(/[\s:]/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return null;
  return hex.match(/.{1,2}/g)?.join(":") ?? null;
}

export function GET() {
  const pkg = process.env.ANDROID_TWA_PACKAGE_NAME?.trim();
  const rawList = process.env.ANDROID_TWA_SHA256_FINGERPRINTS?.trim();

  if (!pkg || !rawList) {
    return NextResponse.json([], {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const fingerprints = rawList
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeSha256Fingerprint)
    .filter((x): x is string => x != null);

  if (fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
