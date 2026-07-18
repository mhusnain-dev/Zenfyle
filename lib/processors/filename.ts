/*
 * Output filename convention (Section 6 / 13.8): zenfyle-{tool-slug}-{shortId}.{ext}
 * — never the original filename. shortId is a short random token so downloads
 * from the same tool don't collide in a downloads folder.
 */
export function outputFilename(slug: string, ext: string): string {
  const shortId = Math.random().toString(36).slice(2, 8);
  const clean = ext.replace(/^\./, "");
  return `zenfyle-${slug}-${shortId}.${clean}`;
}
