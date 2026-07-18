import { CATEGORY_ORDER, TOOLS } from "@/lib/registry";
import { KNOWN_ICON_NAMES } from "@/lib/icons";

/*
 * Registry startup validation — specs.md Section 12. Fails fast on: duplicate
 * slugs, homepageOrder collisions within a category, unresolvable icon names,
 * an active tool missing its optionsComponent, or a requiresJobQueue flag
 * that doesn't mirror processing (Section 4's invariant).
 *
 * Imported from the root layout so any violation breaks build/startup rather
 * than surfacing as a broken page in production.
 */
export function validateRegistry(): void {
  const errors: string[] = [];

  const slugs = new Set<string>();
  for (const tool of TOOLS) {
    if (slugs.has(tool.slug)) errors.push(`duplicate slug: ${tool.slug}`);
    slugs.add(tool.slug);

    if (!KNOWN_ICON_NAMES.has(tool.icon))
      errors.push(`${tool.slug}: icon "${tool.icon}" is not a known icon name`);

    if (tool.status === "active" && !tool.optionsComponent)
      errors.push(`${tool.slug}: active tool missing optionsComponent`);

    if (tool.requiresJobQueue !== (tool.processing === "server"))
      errors.push(`${tool.slug}: requiresJobQueue must mirror processing`);

    for (const related of tool.relatedTools)
      if (!TOOLS.some((t) => t.slug === related))
        errors.push(`${tool.slug}: relatedTools references unknown "${related}"`);
  }

  for (const category of CATEGORY_ORDER) {
    const seen = new Set<number>();
    for (const tool of TOOLS.filter((t) => t.category === category)) {
      if (seen.has(tool.homepageOrder))
        errors.push(
          `homepageOrder collision in ${category}: ${tool.homepageOrder}`,
        );
      seen.add(tool.homepageOrder);
    }
  }

  if (errors.length > 0)
    throw new Error(`Tool registry validation failed:\n- ${errors.join("\n- ")}`);
}
