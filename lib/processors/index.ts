import type { Processor } from "@/lib/processors/types";
import { mergePdf } from "@/lib/processors/merge-pdf";

/*
 * Client-side processor lookup (Section 4.3 / 11.5). Maps a tool slug to its
 * processing function; the tool page machine looks the processor up here by
 * slug — no if/else chain. Adding a client tool = one entry here + one file.
 * A slug with no entry has no client processor yet (server-side or unbuilt).
 */
const PROCESSORS: Record<string, Processor> = {
  "merge-pdf": mergePdf,
};

export function getProcessor(slug: string): Processor | undefined {
  return PROCESSORS[slug];
}
