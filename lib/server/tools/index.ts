import type { ServerProcessor } from "./types";
import { compressPdf } from "./compress-pdf";
import { protectPdf } from "./protect-pdf";
import { unlockPdf } from "./unlock-pdf";
import { wordToPdf } from "./word-to-pdf";

/*
 * Server-tool registry, keyed by the same slug as lib/registry.ts. The worker
 * pipeline resolves an adapter here; a slug with no adapter means the tool
 * isn't server-implemented yet (the Route Handler rejects it up front). Adding
 * a server tool = one adapter file + one line here, mirroring lib/processors.
 */
const SERVER_TOOLS: Record<string, ServerProcessor> = {
  "compress-pdf": compressPdf,
  "protect-pdf": protectPdf,
  "unlock-pdf": unlockPdf,
  "word-to-pdf": wordToPdf,
  // Phase 8 continues: pdf-to-word, excel/ppt ↔ pdf, ... (LibreOffice adapters)
};

export function getServerProcessor(slug: string): ServerProcessor | undefined {
  return SERVER_TOOLS[slug];
}

export function isServerToolImplemented(slug: string): boolean {
  return slug in SERVER_TOOLS;
}

export type { ServerProcessor } from "./types";
