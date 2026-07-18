import type { ToolCategory } from "@/lib/registry";

/*
 * Per-category accent classes — specs.md Section 2 "Category accents"
 * (v1.3.0). One hue per category; consumed by every surface that renders a
 * category or tool card (mega-menu, drawer, homepage grid). The hex values
 * live once in globals.css as --color-cat-* tokens; these are the utility
 * classes over them. Never re-declare accent colors in a component.
 *
 * icon:  tint container bg + jewel-tone stroke (≥3:1, WCAG graphics bar)
 * badge: tint bg + AA text variant (≥4.5:1)
 */
export type CategoryAccent = {
  icon: string; // tint container bg + stroke color (action-icon container)
  badge: string; // tint bg + AA text variant (mono badge)
  action: string; // stroke color as text-only (corner action badge over format icon)
};

export const CATEGORY_ACCENTS: Record<ToolCategory, CategoryAccent> = {
  organize: {
    icon: "bg-cat-organize-tint text-cat-organize",
    badge: "bg-cat-organize-tint text-cat-organize-text",
    action: "text-cat-organize",
  },
  convert: {
    icon: "bg-cat-convert-tint text-cat-convert",
    badge: "bg-cat-convert-tint text-cat-convert-text",
    action: "text-cat-convert",
  },
  compress: {
    icon: "bg-cat-compress-tint text-cat-compress",
    badge: "bg-cat-compress-tint text-cat-compress-text",
    action: "text-cat-compress",
  },
  "edit-sign": {
    icon: "bg-cat-edit-sign-tint text-cat-edit-sign",
    badge: "bg-cat-edit-sign-tint text-cat-edit-sign-text",
    action: "text-cat-edit-sign",
  },
  security: {
    icon: "bg-cat-security-tint text-cat-security",
    badge: "bg-cat-security-tint text-cat-security-text",
    action: "text-cat-security",
  },
};
