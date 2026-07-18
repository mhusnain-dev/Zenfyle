/*
 * Canonical site URL, single source for metadataBase, sitemap, and robots.
 * Override at deploy via NEXT_PUBLIC_SITE_URL; localhost default keeps dev and
 * CI builds working without env config. No trailing slash.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Zenfyle";
