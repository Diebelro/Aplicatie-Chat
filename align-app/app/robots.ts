import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/appUrl";

function siteOrigin(): string {
  const u = getPublicAppUrl();
  if (u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) {
    return (
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      "https://align-app-delta.vercel.app"
    );
  }
  return u.replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const host = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/_next/",
        "/admin",
        "/app/",
        "/completeaza-profilul",
        "/onboarding/",
        "/mobile/",
        "/cont-blocat",
      ],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
