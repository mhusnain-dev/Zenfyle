import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/registry";

/*
 * Sitemap (Section 11.11, Phase 4). Homepage + static routes, plus one entry
 * per non-disabled tool page. Tool URLs come from the registry so a new tool
 * is indexed automatically — no second list to maintain. Tool pages don't
 * render until Phase 5, but listing their canonical URLs now is harmless and
 * keeps the sitemap registry-driven.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = ["", "/pricing"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.5,
  }));

  const toolRoutes = TOOLS.filter((t) => t.status !== "disabled").map(
    (tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...toolRoutes];
}
