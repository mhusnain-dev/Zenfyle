import { PDFDocument } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { parsePageList } from "@/lib/processors/page-range";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Extract Pages — Section 11.5 (client, pdf-lib). The inverse of Remove Pages:
 * build a new document from ONLY the pages the person lists (1-based, e.g.
 * "1,3,5-7"), preserving their input order. Shares the page-list parser so the
 * validation messages match the other page tools.
 */
const SLUG = "extract-pages";

export const extractPages: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF.");

  const spec = (input.options.pages as string) ?? "";

  onProgress(20, "Reading PDF");
  const src = await loadPdf(file);
  const pageCount = src.getPageCount();

  // parsePageList returns a sorted, de-duped, in-range 1-based list.
  const pages = parsePageList(spec, pageCount);
  const indices = pages.map((p) => p - 1);

  onProgress(55, "Extracting pages");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));

  onProgress(90, "Writing PDF");
  const blob = await toPdfBlob(out);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Extracted ${pages.length} page${pages.length === 1 ? "" : "s"} into a new PDF`,
  };
};
