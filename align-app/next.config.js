/** @type {import('next').NextConfig} */
/** Nu seta `output: "export"` — dezactivează Route Handlers; `/api/*` (ex. ice-config) devin 404. */
const crypto = require("crypto");

// Hash unic per build pentru watermark și audit (nu expune secrets)
const buildHash = process.env.NEXT_PUBLIC_BUILD_HASH || crypto.createHash("sha256").update(`${Date.now()}-${process.pid}`).digest("hex").slice(0, 16);

const nextConfig = {
  experimental: {
    instrumentationHook: true,
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
};

module.exports = nextConfig;
