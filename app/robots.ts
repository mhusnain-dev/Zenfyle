import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/*
 * robots.txt (Section 11.11, Phase 4). Allow all crawling; disallow the
 * account/API surfaces that shouldn't be indexed (they arrive in later
 * phases — listing them now is harmless and avoids revisiting this file).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
