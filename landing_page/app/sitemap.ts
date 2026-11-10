import type { MetadataRoute } from "next";
import { getSiteUrl } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    { url: new URL("/", siteUrl).toString(), priority: 1 },
    { url: new URL("/credits", siteUrl).toString(), priority: 0.3 },
  ];
}
