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
import { pdfToExcel } from "./pdf-to-excel";
import { comparePdf } from "./compare-pdf";
import { redactPdf } from "./redact-pdf";
import { ocrPdfTool } from "./ocr-pdf";

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
  // pdf-to-excel: geometry-based table extraction + Tesseract OCR fallback for
  // scanned pages (spec v1.4.3). Not LibreOffice — it has no PDF→Calc filter.
  "pdf-to-excel": pdfToExcel,
  "compare-pdf": comparePdf,
  // redact-pdf: permanent removal via flatten + re-OCR searchable layer (§4.1c).
  "redact-pdf": redactPdf,
  // ocr-pdf: flatten + re-OCR invisible text layer to make a scan searchable
  // (spec v1.4.4). Same pipeline as redact-pdf minus the region blackout.
  "ocr-pdf": ocrPdfTool,
};

export function getServerProcessor(slug: string): ServerProcessor | undefined {
  return SERVER_TOOLS[slug];
}

export function isServerToolImplemented(slug: string): boolean {
  return slug in SERVER_TOOLS;
}

export type { ServerProcessor } from "./types";
