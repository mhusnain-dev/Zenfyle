import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  TextRenderingMode,
  rgb,
  setTextRenderingMode,
} from "pdf-lib";
import { ProcessingError } from "./types";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
} from "./types";
import { renderPage, pngSize, ocrImage, OCR_DPI } from "./ocr";

/*
 * OCR PDF adapter (spec v1.4.4) — make a scanned/image-only PDF SEARCHABLE.
 *
 * A scanned PDF is just page images with no text layer, so nothing in it can be
 * searched, selected, or copied. This tool rebuilds each page as a flattened
 * image with an INVISIBLE OCR text layer behind it (render mode 3), so the
 * visible page is unchanged but the recognized words are now selectable and
 * searchable. This is exactly redact-pdf's flatten + re-OCR pipeline WITHOUT the
 * region-blackout step, so it reuses the same ocr.ts adapter (the one Tesseract
 * spawn point) and the same pdf-lib assembly.
 *
 * Because it rasterizes every page, it's meant for scans; running it on an
 * already-digital PDF would needlessly flatten crisp vector text to an image.
 * We can't reliably tell the two apart per-page without extra tooling, so the
 * result carries an honest note rather than silently degrading a digital PDF.
 *
 * If OCR recognizes no text on ANY page, the document has nothing to make
 * searchable (blank/graphic-only), so we fail explicitly (UNSUPPORTED_FILE_TYPE,
 * §592) rather than returning a rasterized copy that gained nothing.
 */

/** 72 PDF points per inch; images are rendered at OCR_DPI. */
const POINTS_PER_INCH = 72;

export async function ocrPdfTool(
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> {
  await onProgress("reading", 8);

  const srcData = new Uint8Array(await fs.readFile(input.inputPath));
  let pageCount: number;
  try {
    const src = await PDFDocument.load(srcData, { updateMetadata: false });
    pageCount = src.getPageCount();
  } catch (err) {
    throw new ProcessingError(
      "This PDF couldn't be read. It may be corrupted or password-protected.",
      { code: "FILE_CORRUPTED", cause: err },
    );
  }

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);

  let totalWords = 0;

  for (let p = 1; p <= pageCount; p++) {
    if (signal.aborted) throw new Error("cancelled");
    await onProgress("recognizing", 8 + Math.round((p / pageCount) * 82));

    // 1. Rasterize the page to a PNG at OCR resolution.
    const imagePath = await renderPage(input.inputPath, p, input.workDir, signal);
    const { width: imgW, height: imgH } = await pngSize(imagePath);

    // 2. OCR the rendered page to recover its words + positions.
    let words: Awaited<ReturnType<typeof ocrImage>> = [];
    try {
      words = await ocrImage(imagePath, signal);
    } catch {
      // OCR is best-effort per page; a page that fails recognition is still
      // carried through as an image so the document stays intact.
      words = [];
    }
    totalWords += words.filter((w) => w.text.trim()).length;

    // 3. Place the page image on a new page sized in points, then draw the OCR
    //    words invisibly on top at their positions so the page stays searchable.
    const pngBytes = await fs.readFile(imagePath);
    const png = await out.embedPng(new Uint8Array(pngBytes));
    const pageW = (imgW / OCR_DPI) * POINTS_PER_INCH;
    const pageH = (imgH / OCR_DPI) * POINTS_PER_INCH;
    const page = out.addPage([pageW, pageH]);
    page.drawImage(png, { x: 0, y: 0, width: pageW, height: pageH });

    // pdf-lib 1.17.1's drawText has no renderingMode option, so set invisible
    // text mode (Tr 3) via the operator before drawing — it persists in the
    // page's graphics state, so the OCR words below render invisibly (present
    // for search/select, not painted over the flattened image).
    if (words.length > 0) {
      page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
    }

    const scale = POINTS_PER_INCH / OCR_DPI; // px → pt
    for (const w of words) {
      if (!w.text.trim()) continue;
      const fontSize = Math.max(1, w.height * scale);
      // pdf-lib y-origin is bottom-left; OCR boxes are top-left.
      const xPt = w.left * scale;
      const yPt = pageH - (w.top + w.height) * scale;
      page.drawText(w.text, {
        x: xPt,
        y: yPt,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    await fs.rm(imagePath, { force: true });
  }

  if (totalWords === 0) {
    throw new ProcessingError(
      "No text could be recognized in this PDF, so there's nothing to make searchable. It may be blank or contain only graphics.",
      { code: "UNSUPPORTED_FILE_TYPE" },
    );
  }

  if (signal.aborted) throw new Error("cancelled");
  await onProgress("finishing", 94);

  const outputName = `zenfyle-ocr-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);
  const outBytes = await out.save();
  await fs.writeFile(outputPath, outBytes);

  await onProgress("finishing", 100);

  const pageWord = pageCount === 1 ? "page" : "pages";
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Recognized ${totalWords.toLocaleString()} words across ${pageCount} ${pageWord} — your PDF is now searchable.`,
    note: "Text recognition is best-effort and accuracy depends on scan quality, so proofread before relying on the searchable text. Each page was flattened to an image with an invisible text layer added behind it; this tool is meant for scanned PDFs, not ones that already have selectable text.",
  };
}
