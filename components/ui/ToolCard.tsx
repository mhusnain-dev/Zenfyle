import Link from "next/link";
import type { Tool } from "@/lib/registry";
import { CATEGORY_ACCENTS } from "@/lib/accents";
import { formatIconForTool, TOOL_ICONS } from "@/lib/icons";

/*
 * Shared tool entry card — specs.md Section 3.3's dropdown entry pattern,
 * reused by the homepage grid in Phase 4 (Section 4: one card component, no
 * duplication). `variant="row"` is the mobile-drawer single-column layout
 * (Section 3.5); `variant="grid"` the desktop mega-menu layout.
 *
 * Icons and badges take the tool's category accent (Section 2 v1.3.0): the
 * icon sits in a pastel tint container with a jewel-tone stroke; the badge
 * uses the accent's AA text variant. Accent values come from CATEGORY_ACCENTS
 * only — never inlined here.
 *
 * Tools with status !== 'active' render the card with click-through disabled
 * (Section 4's comingSoon behavior). When tools activate in Phase 5+, this
 * becomes a Link to /tools/[slug].
 *
 * The optional `badgeStyle` lets the mega-menu apply its stagger-fade
 * animation delay (Section 3.4) — that effect is scoped to the menu only.
 */
export function ToolCard({
  tool,
  variant = "grid",
  badgeStyle,
}: {
  tool: Tool;
  variant?: "grid" | "row";
  badgeStyle?: React.CSSProperties;
}) {
  const accent = CATEGORY_ACCENTS[tool.category];
  const disabled = tool.status !== "active";

  // Every tool shows its real file-format icon in brand color (v1.4.0, all
  // dropdowns). The Lucide icon named in the registry becomes a small corner
  // action badge in the category color, so same-format tools (Merge/Split/
  // Sign/Redact — all PDF) stay visually distinct. Convert tools name a format
  // glyph directly and carry no distinct action badge.
  const format = formatIconForTool(tool);
  const ActionIcon = TOOL_ICONS[tool.icon];
  const showActionBadge = Boolean(ActionIcon);

  const iconContainer = (
    <span
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-white ring-1 ring-border transition-transform duration-[120ms] group-hover/entry:scale-105"
      style={{ color: format.brand }}
      aria-hidden
    >
      <format.icon size={24} />
      {showActionBadge && (
        <span
          className={`absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] ${accent.action}`}
        >
          <ActionIcon size={11} strokeWidth={2.5} />
        </span>
      )}
    </span>
  );

  const inner = (
    <>
      {iconContainer}
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-medium text-text">
          {tool.name}
          {disabled && (
            <span className="ml-2 rounded-badge bg-icon-bg px-1.5 py-0.5 font-mono text-[10px] font-medium text-signal">
              SOON
            </span>
          )}
        </span>
        <span
          style={badgeStyle}
          className={`mt-1 inline-block rounded-[4px] px-1.5 py-0.5 font-mono text-[11px] font-medium ${accent.badge}`}
        >
          {tool.badge}
        </span>
        <span className="mt-1 block font-body text-[13px] leading-[18px] text-text-secondary">
          {tool.description}
        </span>
      </span>
    </>
  );

  const layout =
    variant === "grid"
      ? "flex items-start gap-3 rounded-card p-3 transition-all duration-[120ms] hover:bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
      : "flex min-h-11 items-start gap-3 py-4";

  // Active tools link to /tools/[slug]; non-active render as a non-navigating
  // card (Section 4 comingSoon rule).
  if (disabled) {
    return (
      <div className={`group/entry ${layout}`} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/tools/${tool.slug}`} className={`group/entry ${layout}`}>
      {inner}
    </Link>
  );
}
