import type { MetadataRoute } from "next";
import { getPublicAppUrl, CHAT_PRODUCTION_URL } from "@/lib/appUrl";

function siteOrigin(): string {
  const u = getPublicAppUrl();
  if (u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) {
    return (
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      CHAT_PRODUCTION_URL
    );
  }
  return u.replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteOrigin();
  const now = new Date();

  const paths: {
    path: string;
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.8 },
    { path: "/login", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
    { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
    { path: "/community-rules", changeFrequency: "yearly", priority: 0.35 },
  ];

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
