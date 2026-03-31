/** @type {import('next').NextConfig} */
/** Nu seta `output: "export"` — dezactivează Route Handlers; `/api/*` (ex. ice-config) devin 404. */
const crypto = require("crypto");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Identificator stabil per commit: local (git), Vercel (VERCEL_GIT_COMMIT_SHA), sau override explicit.
 * Fără asta, Date.now()+pid schimba „versiunea” la fiecare restart / build incomparabil cu git.
 */
function resolveBuildHash() {
  if (process.env.NEXT_PUBLIC_BUILD_HASH) {
    return String(process.env.NEXT_PUBLIC_BUILD_HASH).slice(0, 16);
  }
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha && /^[a-f0-9]{7,40}$/i.test(vercelSha.trim())) {
    return vercelSha.trim().slice(0, 16);
  }
  try {
    const head = execSync("git rev-parse HEAD", {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (head && /^[a-f0-9]{7,40}$/i.test(head)) {
      return head.slice(0, 16);
    }
  } catch {
    // fără .git (ex. deploy din arhivă)
  }
  return crypto.createHash("sha256").update(`${Date.now()}-${process.pid}`).digest("hex").slice(0, 16);
}

const buildHash = resolveBuildHash();

const nextConfig = {
  /** Dev: permite HMR când deschizi site-ul pe 127.0.0.1 vs localhost (altfel Next blochează /_next/webpack-hmr). */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /** Rădăcină explicită: evită avertismentul Turbopack când există alt lockfile în repo părinte. */
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "**.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_HASH: buildHash,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async redirects() {
    return [
      { source: "/termeni", destination: "/terms", permanent: true },
      { source: "/confidentialitate", destination: "/privacy", permanent: true },
    ];
  },
  /**
   * Antete de securitate pentru toate rutele (defense in depth).
   * HSTS doar în producție și numai pe HTTPS real; dezactivează cu DISABLE_HSTS=1 dacă testezi HTTP neintenționat.
   */
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()",
      },
    ];
    const httpsProduction =
      process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") || process.env.VERCEL === "1";
    if (process.env.NODE_ENV === "production" && process.env.DISABLE_HSTS !== "1" && httpsProduction) {
      base.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }
    return [{ source: "/:path*", headers: base }];
  },
};

module.exports = nextConfig;
