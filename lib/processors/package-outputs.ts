import JSZip from "jszip";
import { outputFilename } from "@/lib/processors/filename";
import type { OutputFile } from "@/lib/processors/types";

/*
 * Central multi-output packaging (Section 6 output-naming rule). Every
 * processor returns its raw per-file list; this is the ONE place that decides
 * presentation, so no tool re-implements it:
 *   - 1 output  → hand it through unchanged (single download button)
 *   - 2-3       → returned as-is (the result screen offers each as a link)
 *   - >3        → zipped into one zenfyle-{slug}-{shortId}.zip (one button)
 * Keeping this out of the processors means Split/future multi-output tools
 * stay focused on producing pages, not on ZIP mechanics.
 */
export async function packageOutputs(
  slug: string,
  outputs: OutputFile[],
): Promise<OutputFile[]> {
  if (outputs.length <= 3) return outputs;

  const zip = new JSZip();
  for (const file of outputs) zip.file(file.filename, file.blob);
  const blob = await zip.generateAsync({ type: "blob" });

  return [{ blob, filename: outputFilename(slug, "zip") }];
}
