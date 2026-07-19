import path from "node:path";
import { pathToFileURL } from "node:url";
import { ProcessingError } from "./types";

/*
 * Server-side PDF text extraction (used by compare-pdf, §4.1c / §251). Uses the
 * pdfjs-dist *legacy* build because the default build assumes browser globals
 * (DOMMatrix, a worker) that don't exist in Node; the legacy build runs
 * worker-less in-process. We only pull the text layer — no rendering — so this
 * is cheap and has no canvas dependency.
 *
 * This is deliberately the ONLY place server code imports pdfjs, mirroring the
 * one-adapter-per-library rule the other server tools follow.
 */

export type PageText = {
  /** 1-based page number. */
  page: number;
  /** Extracted text for the page, whitespace-normalized, "" if the page had none. */
  text: string;
};

export type ExtractResult = {
  pages: PageText[];
  /** Total characters of extracted text across all pages (drives scanned detection). */
  totalChars: number;
};

/*
 * Heuristic threshold for "this PDF has no real text layer" (a scanned/image
 * PDF). pdfjs returns an empty (or near-empty) text content for image-only
 * pages; a handful of stray characters from noise shouldn't count as text. The
 * spec requires we reject scanned PDFs with a clear error rather than diff an
 * empty string against real text and report a bogus "everything changed".
 */
const MIN_TEXT_CHARS = 8;

export async function extractPdfText(data: Uint8Array): Promise<ExtractResult> {
  // Legacy build: worker-less, Node-safe. Imported dynamically so the heavy
  // module only loads when a compare job actually runs.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Resolve pdfjs's own asset files from node_modules on the real filesystem.
  // We build the path from process.cwd() rather than require.resolve/import.meta
  // because Next's bundler rewrites those to virtual paths (e.g. "[project]/..."),
  // which pdfjs then fails to import at runtime.
  const pkgDir = path.join(process.cwd(), "node_modules", "pdfjs-dist");

  // Point pdfjs at its own bundled standard fonts so PDFs that reference the 14
  // base fonts extract cleanly (and without a per-page console warning). The
  // trailing separator is required — pdfjs concatenates the font filename onto
  // this string directly.
  const standardFontDataUrl =
    path.join(pkgDir, "standard_fonts") + path.sep;

  // Point the worker at the real file on disk. In plain Node pdfjs falls back to
  // a "fake worker" that dynamically imports the worker module; under Next's
  // bundler that import is otherwise rewritten to a chunk path that doesn't
  // exist, so getDocument throws "Setting up fake worker failed". A concrete
  // file:// URL makes the fake-worker loader read the actual file instead.
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(pkgDir, "legacy", "build", "pdf.worker.mjs"),
  ).href;

  let doc;
  try {
    doc = await pdfjs.getDocument({ data, standardFontDataUrl }).promise;
  } catch (err) {
    throw new ProcessingError(
      "This PDF couldn't be read. It may be corrupted or password-protected.",
      { code: "FILE_CORRUPTED", cause: err },
    );
  }

  const pages: PageText[] = [];
  let totalChars = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Join the text items; pdfjs splits on layout, not words, so collapse runs
    // of whitespace to keep the diff about content, not spacing artifacts.
    const raw = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    const text = raw.replace(/\s+/g, " ").trim();
    totalChars += text.length;
    pages.push({ page: i, text });
    page.cleanup();
  }

  await doc.cleanup();
  return { pages, totalChars };
}

/**
 * A word (text item) with its position on the page, in PDF user-space points
 * with a TOP-LEFT origin (y measured down from the page top, matching image
 * space). Used by pdf-to-excel to cluster words into table rows/columns.
 */
export type PositionedWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PositionedPage = {
  page: number;
  /** Page size in points (the coordinate space of `words`). */
  pageWidth: number;
  pageHeight: number;
  words: PositionedWord[];
};

/**
 * Extract text items with positions from a PDF's digital text layer (no OCR).
 * pdfjs gives each item a transform matrix in PDF space (bottom-left origin);
 * we flip y to a top-left origin so downstream geometry matches the OCR path
 * and image space. Returns [] words for pages with no text layer. Used by
 * pdf-to-excel for PDFs that already carry real text.
 */
export async function extractPositionedText(
  data: Uint8Array,
): Promise<PositionedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pkgDir = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  const standardFontDataUrl = path.join(pkgDir, "standard_fonts") + path.sep;
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(pkgDir, "legacy", "build", "pdf.worker.mjs"),
  ).href;

  let doc;
  try {
    doc = await pdfjs.getDocument({ data, standardFontDataUrl }).promise;
  } catch (err) {
    throw new ProcessingError(
      "This PDF couldn't be read. It may be corrupted or password-protected.",
      { code: "FILE_CORRUPTED", cause: err },
    );
  }

  const result: PositionedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const content = await page.getTextContent();
    const words: PositionedWord[] = [];
    for (const it of content.items) {
      if (!("str" in it) || it.str.trim() === "") continue;
      // transform = [a, b, c, d, e, f]; e,f is the item origin (baseline, in
      // PDF space, bottom-left origin). Height ≈ the font's transformed size.
      const [, , , d, e, f] = it.transform as number[];
      const height = Math.abs(d) || it.height || 0;
      words.push({
        text: it.str,
        x: e,
        // Flip to a top-left origin; f is the baseline, so subtract the glyph
        // height to reach the top of the text box.
        y: pageHeight - f - height,
        width: it.width,
        height,
      });
    }
    result.push({
      page: i,
      pageWidth: viewport.width,
      pageHeight,
      words,
    });
    page.cleanup();
  }
  await doc.cleanup();
  return result;
}

/**
 * Throw an UNSUPPORTED_FILE_TYPE error if a document has no extractable text
 * layer (a scanned/image-only PDF). Per §251 compare-pdf must reject these
 * instead of producing a meaningless diff. `label` names which file for the
 * user ("first"/"second").
 */
export function assertHasText(result: ExtractResult, label: string): void {
  if (result.totalChars < MIN_TEXT_CHARS) {
    throw new ProcessingError(
      `The ${label} PDF has no readable text layer — it looks like a scanned or image-only document. Compare PDF works on text, so it can't diff this file.`,
      { code: "UNSUPPORTED_FILE_TYPE" },
    );
  }
}
