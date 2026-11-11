import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  return origin ? [{ url: origin, changeFrequency: "monthly", priority: 1 }] : [];
}
