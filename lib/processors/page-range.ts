/*
 * Shared 1-indexed page-list parser for tools that take a page spec (Split at
 * specific pages, Remove Pages). Accepts comma-separated pages and hyphen
 * ranges: "3,7,10" or "2-5, 9". Pages are 1-based in the UI (what the person
 * sees); callers convert to 0-based indices themselves. Throws a clear,
 * user-facing message on anything invalid so the tool page can show it inline.
 */
export function parsePageList(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter at least one page number.");

  const pages = new Set<number>();

  for (const rawPart of trimmed.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end)
        throw new Error(`Range "${part}" is backwards — use e.g. ${end}-${start}.`);
      for (let p = start; p <= end; p++) pages.add(p);
      continue;
    }

    if (!/^\d+$/.test(part))
      throw new Error(`"${part}" isn't a page number. Use numbers like 3, 7, 10.`);
    pages.add(Number(part));
  }

  const sorted = [...pages].sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error("Enter at least one page number.");

  const out = sorted[sorted.length - 1];
  if (sorted[0] < 1 || out > pageCount)
    throw new Error(
      `This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}; ${out > pageCount ? `page ${out} is out of range` : "page numbers start at 1"}.`,
    );

  return sorted;
}
