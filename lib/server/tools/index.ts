import type { ServerProcessor } from "./types";
import { compressPdf } from "./compress-pdf";
import { protectPdf } from "./protect-pdf";
import { unlockPdf } from "./unlock-pdf";
import { wordToPdf } from "./word-to-pdf";
import { excelToPdf } from "./excel-to-pdf";
import { pptToPdf } from "./ppt-to-pdf";
import { pdfToJpg } from "./pdf-to-jpg";
import { pdfToPng } from "./pdf-to-png";
import { pdfToWord } from "./pdf-to-word";
import { pdfToPpt } from "./pdf-to-ppt";

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
  "pdf-to-word": pdfToWord,
  "pdf-to-ppt": pdfToPpt,
  // pdf-to-excel stays comingSoon: LibreOffice has no PDF→Calc import filter,
  // and faking table extraction would violate the anti-hallucination rule (§588).
};

export function getServerProcessor(slug: string): ServerProcessor | undefined {
  return SERVER_TOOLS[slug];
}

export function isServerToolImplemented(slug: string): boolean {
  return slug in SERVER_TOOLS;
}

export type { ServerProcessor } from "./types";
