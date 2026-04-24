/** @type {import('next').NextConfig} */
/** Nu seta `output: "export"` — dezactivează Route Handlers; `/api/*` (ex. ice-config) devin 404. */
const path = require("path");

/**
 * Commit complet (40 hex) injectat la build din CI/Vercel — fără git la runtime.
 * Lipsește variabila → "unknown" (stabil, comparabil între deploy-uri).
 */
function resolveBuildCommitFull() {
  const candidates = [
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
  ];
  for (const raw of candidates) {
    const t = String(raw || "")
      .trim()
      .toLowerCase();
    if (/^[a-f0-9]{40}$/.test(t)) return t;
  }
  return "unknown";
}

function resolveBuildCommitShort(full) {
  if (full === "unknown") return "unknown";
  return full.slice(0, 16);
}

const buildCommitFull = resolveBuildCommitFull();
const buildCommitShort = resolveBuildCommitShort(buildCommitFull);
/** Alias scurt pentru bundle (compat); același prefix ca build metadata. */
const buildHash = buildCommitShort;

/**
 * NextAuth în `next-auth/react` citește `process.env.NEXTAUTH_URL` în bundle-ul client.
 * Fără valoare (sau cu URL de producție când rulezi pe localhost), `getSession` pică → CLIENT_FETCH_ERROR.
 * Dacă ai tras env de pe Vercel dar testezi local: pune la sfârșitul lui `.env.local`
 * `NEXTAUTH_URL=http://localhost:3005` (vezi .env.example). Aici aliniez automat când vezi
 * NEXT_PUBLIC_APP_URL pe localhost dar NEXTAUTH_URL e încă https de producție.
 */
function resolveNextAuthUrlForBundle() {
  const explicit = process.env.NEXTAUTH_URL?.trim();
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const dev = process.env.NODE_ENV !== "production";

  /**
   * În dev, NEXTAUTH_URL=https://… (ex. tras de pe Vercel) + tab pe localhost → next-auth/react
   * altfel încearcă sesiunea pe HTTPS producție → CLIENT_FETCH_ERROR + overlay Next peste tot UI-ul.
   * Forțăm URL http local în bundle când NEXTAUTH_URL e HTTPS.
   */
  if (dev && explicit && /^https:\/\//i.test(explicit)) {
    if (pub && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(pub)) {
      console.warn(
        "[next.config] Dev: NEXTAUTH_URL HTTPS + NEXT_PUBLIC_APP_URL local — client folosește %s.",
        pub.replace(/\/$/, "")
      );
      return pub.replace(/\/$/, "");
    }
    console.warn(
      "[next.config] Dev: NEXTAUTH_URL este HTTPS (producție); pentru next-auth/react folosesc http://localhost:3005. Adaugă în .env.local: NEXTAUTH_URL=http://localhost:3005 și NEXT_PUBLIC_APP_URL=http://localhost:3005 (aliniază cu portul dev)."
    );
    return "http://localhost:3005";
  }
  if (explicit) {
    let e = explicit.replace(/\/$/, "");
    /** Producție: NEXTAUTH_URL=https://diebel.ro trimite OAuth/sesiunea pe site-ul marketing — folosim chat. */
    if (!dev) {
      try {
        const u = new URL(e);
        const h = u.hostname.toLowerCase();
        if (!u.port && (h === "diebel.ro" || h === "www.diebel.ro")) {
          const pubNorm = pub ? pub.replace(/\/$/, "") : "";
          e = pubNorm && /^https:\/\//i.test(pubNorm) ? pubNorm : "https://chat.diebel.ro";
        }
      } catch {
        /* păstrăm e */
      }
    }
    return e;
  }
  if (dev) {
    if (pub && /^http:\/\//i.test(pub)) return pub.replace(/\/$/, "");
    return "http://localhost:3005";
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  return "";
}

/** Dev: URL WS local dacă lipsește din `.env` — aliniat cu `npm run dev` care pornește și semnalizarea pe 4001. */
function resolveNextPublicSignalingWsUrl() {
  const w = process.env.NEXT_PUBLIC_SIGNALING_WS_URL?.trim();
  if (w) return w;
  if (process.env.NODE_ENV !== "production") {
    return "ws://127.0.0.1:4001";
  }
  return undefined;
}

const devSignalingWsUrl = resolveNextPublicSignalingWsUrl();

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
    NEXT_PUBLIC_BUILD_COMMIT_FULL: buildCommitFull,
    NEXT_PUBLIC_BUILD_COMMIT_SHORT: buildCommitShort,
    NEXTAUTH_URL: resolveNextAuthUrlForBundle(),
    ...(devSignalingWsUrl ? { NEXT_PUBLIC_SIGNALING_WS_URL: devSignalingWsUrl } : {}),
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async redirects() {
    return [
      { source: "/termeni", destination: "/terms", permanent: true },
      { source: "/confidentialitate", destination: "/privacy", permanent: true },
      /** Google Play / linkuri externe: alias canonic către politica publică. */
      { source: "/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/privacy-policy/", destination: "/privacy", permanent: true },
      /** Fără acestea /api/auth/:provider clădea /api/auth/session (NextAuth). */
      { source: "/api/auth/google", destination: "/api/auth/legacy/google", permanent: false },
      { source: "/api/auth/apple", destination: "/api/auth/legacy/apple", permanent: false },
      { source: "/api/auth/microsoft", destination: "/api/auth/legacy/microsoft", permanent: false },
      { source: "/api/auth/facebook", destination: "/api/auth/legacy/facebook", permanent: false },
      { source: "/api/auth/phone", destination: "/api/auth/legacy/phone", permanent: false },
      { source: "/api/auth/yahoo", destination: "/api/auth/legacy/yahoo", permanent: false },
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
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
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
