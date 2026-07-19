import type { ServerProcessor } from "./types";
import { compressPdf } from "./compress-pdf";
import { protectPdf } from "./protect-pdf";
import { unlockPdf } from "./unlock-pdf";
import { wordToPdf } from "./word-to-pdf";
import { excelToPdf } from "./excel-to-pdf";
import { pptToPdf } from "./ppt-to-pdf";
import { pdfToJpg } from "./pdf-to-jpg";
import { pdfToPng } from "./pdf-to-png";

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
  "excel-to-pdf": excelToPdf,
  "ppt-to-pdf": pptToPdf,
  "pdf-to-jpg": pdfToJpg,
  "pdf-to-png": pdfToPng,
  // Phase 8 continues: pdf-to-word/excel/ppt (lossy reverse), jpg-to-pdf, ...
};

export function getServerProcessor(slug: string): ServerProcessor | undefined {
  return SERVER_TOOLS[slug];
}

export function isServerToolImplemented(slug: string): boolean {
  return slug in SERVER_TOOLS;
}

export type { ServerProcessor } from "./types";
