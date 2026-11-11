import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  return origin ? {
    rules: { userAgent: "*", allow: "/", disallow: ["/app$", "/app/", "/api/", "/login", "/register", "/forgot-password", "/reset-password", "/onboarding", "/demo"] },
    sitemap: `${origin}/sitemap.xml`,
  } : { rules: { userAgent: "*", disallow: "/" } };
}
