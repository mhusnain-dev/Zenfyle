"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  searchTools,
  toolsByCategory,
  type Tool,
  type ToolCategory,
} from "@/lib/registry";
import { CATEGORY_ACCENTS } from "@/lib/accents";
import { ToolCard } from "@/components/ui/ToolCard";
import { Search } from "lucide-react";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

/*
 * Homepage tool grid (Section 11.3 step 3 + 13.1). A single search input sits
 * above the five category sections; each section is a labeled row of the same
 * ToolCard used by the header dropdown (Section 4: one card component). Search
 * filters instantly via the registry's searchTools (name/keywords/description),
 * debounced ~150ms. Empty state per Section 11.10. This is the only client
 * component on the homepage — the input needs state; everything else it renders
 * is registry data.
 */
export function SearchableToolGrid() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 150);

  // No query → all tools grouped by category, in category order. With a query
  // → flat ranked results from the registry, still grouped for a stable layout.
  const grouped = useMemo<{ category: ToolCategory; tools: Tool[] }[]>(() => {
    const q = debounced.trim();
    if (!q) {
      return CATEGORY_ORDER.map((category) => ({
        category,
        tools: toolsByCategory(category),
      }));
    }
    const matches = searchTools(q);
    const byCategory = new Map<ToolCategory, Tool[]>();
    for (const tool of matches) {
      const list = byCategory.get(tool.category) ?? [];
      list.push(tool);
      byCategory.set(tool.category, list);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      tools: byCategory.get(category)!,
    }));
  }, [debounced]);

  const totalMatches = grouped.reduce((n, g) => n + g.tools.length, 0);
  const searching = debounced.trim().length > 0;

  return (
    <div>
      <div className="relative max-w-md">
        <Search
          size={18}
          strokeWidth={2}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all tools..."
          aria-label="Search all tools"
          className="w-full rounded-card border border-border bg-white py-3 pl-11 pr-4 font-body text-base text-text shadow-sm outline-none transition-colors placeholder:text-text-secondary focus:border-signal focus:ring-2 focus:ring-signal/20"
        />
      </div>

      {searching && (
        <p
          className="mt-3 font-body text-[13px] text-text-secondary"
          aria-live="polite"
        >
          {totalMatches > 0
            ? `${totalMatches} tool${totalMatches === 1 ? "" : "s"} found`
            : ""}
        </p>
      )}

      {totalMatches === 0 && searching ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-paper-alt py-16 text-center">
          <p className="font-display text-lg font-medium text-text">
            No tools found — try a different word
          </p>
          <p className="mt-2 font-body text-[13px] text-text-secondary">
            Search by what you want to do — “merge”, “compress”, “sign”.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {grouped.map(({ category, tools }) => {
            const accent = CATEGORY_ACCENTS[category];
            return (
              <section key={category} aria-labelledby={`cat-${category}`}>
                <div className="flex items-center gap-3">
                  <h3
                    id={`cat-${category}`}
                    className="font-display text-xl font-medium leading-7 text-text"
                  >
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <span
                    className={`rounded-badge px-2 py-0.5 font-mono text-[11px] font-medium ${accent.badge}`}
                  >
                    {tools.length} {tools.length === 1 ? "TOOL" : "TOOLS"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} variant="grid" />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
