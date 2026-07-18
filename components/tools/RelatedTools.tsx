import Link from "next/link";
import { getRelatedTools } from "@/lib/registry";
import { formatIconForTool, TOOL_ICONS } from "@/lib/icons";
import { CATEGORY_ACCENTS } from "@/lib/accents";

/*
 * "Related tools" row (Section 11.4) — 2–3 tools from the same category, read
 * from the registry's relatedTools field (getRelatedTools). Server component:
 * it's static links, no interactivity.
 */
export function RelatedTools({ slug }: { slug: string }) {
  const related = getRelatedTools(slug);
  if (related.length === 0) return null;

  return (
    <section className="mt-14 border-t border-border pt-8">
      <h2 className="font-display text-lg font-medium text-text">
        Related tools
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((tool) => {
          const format = formatIconForTool(tool);
          const ActionIcon = TOOL_ICONS[tool.icon];
          const accent = CATEGORY_ACCENTS[tool.category];
          return (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group flex items-start gap-3 rounded-card border border-border bg-white p-3 transition-all hover:border-signal hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <span
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-white ring-1 ring-border"
                style={{ color: format.brand }}
                aria-hidden
              >
                <format.icon size={22} />
                {ActionIcon && (
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] ${accent.action}`}
                  >
                    <ActionIcon size={10} strokeWidth={2.5} />
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[14px] font-medium text-text">
                  {tool.name}
                </span>
                <span className="mt-0.5 block font-body text-[12px] leading-[16px] text-text-secondary">
                  {tool.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
