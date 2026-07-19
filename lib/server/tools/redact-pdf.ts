import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
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
 * Redact PDF adapter (§4.1c: PERMANENT removal, never a cosmetic overlay).
 *
 * The failure mode §4.1c calls out is a black rectangle drawn over text that
 * stays selectable/copyable underneath. To make removal real, every page is
 * FLATTENED: rasterized to an image (Ghostscript), the marked regions are
 * painted solid black onto the pixels (sharp), so the underlying content is
 * physically gone — there is no text object left to extract. We then rebuild a
 * searchable text layer by OCR'ing the already-redacted image (Tesseract) and
 * drawing that text INVISIBLY (render mode 3) behind the image, so the result
 * stays searchable/selectable EXCEPT for the blacked-out areas (which contain
 * no pixels to recognize, hence nothing to extract). Assembled with pdf-lib.
 *
 * Input options.redactions: RedactBox[] in normalized page coords (0–1,
 * top-left origin) from RedactOptions. No options = nothing to redact → error.
 */

type RedactBox = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 72 PDF points per inch; images are rendered at OCR_DPI. */
const POINTS_PER_INCH = 72;

function parseBoxes(options: Record<string, unknown>): RedactBox[] {
  const raw = options.redactions;
  if (!Array.isArray(raw)) return [];
  const boxes: RedactBox[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (
      typeof o.page === "number" &&
      typeof o.x === "number" &&
      typeof o.y === "number" &&
      typeof o.width === "number" &&
      typeof o.height === "number"
    ) {
      boxes.push({
        page: o.page,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
      });
    }
  }
  return boxes;
}

export async function redactPdf(
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> {
  const boxes = parseBoxes(input.options);
  if (boxes.length === 0) {
    throw new ProcessingError(
      "No areas were marked for redaction. Draw at least one box over the content to remove.",
      { code: "UNSUPPORTED_FILE_TYPE" },
    );
  }

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

  // Only rasterize pages that exist; iterate every page so unredacted pages are
  // preserved (also flattened, to keep the document visually uniform).
  for (let p = 1; p <= pageCount; p++) {
    if (signal.aborted) throw new Error("cancelled");
    await onProgress("redacting", 8 + Math.round((p / pageCount) * 78));

    // 1. Rasterize the page to a PNG at OCR resolution.
    const imagePath = await renderPage(input.inputPath, p, input.workDir, signal);
    const { width: imgW, height: imgH } = await pngSize(imagePath);

    // 2. Burn the page's redaction boxes to solid black onto the pixels.
    const pageBoxes = boxes.filter((b) => b.page === p);
    let redactedPath = imagePath;
    if (pageBoxes.length > 0) {
      const overlays = pageBoxes.map((b) => {
        // Clamp to image bounds; sharp throws on out-of-canvas composites.
        const left = Math.max(0, Math.round(b.x * imgW));
        const top = Math.max(0, Math.round(b.y * imgH));
        const w = Math.max(1, Math.min(Math.round(b.width * imgW), imgW - left));
        const h = Math.max(1, Math.min(Math.round(b.height * imgH), imgH - top));
        return {
          input: {
            create: {
              width: w,
              height: h,
              channels: 4 as const,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          },
          left,
          top,
        };
      });
      redactedPath = path.join(input.workDir, `redacted-${p}.png`);
      await sharp(imagePath).composite(overlays).png().toFile(redactedPath);
      await fs.rm(imagePath, { force: true });
    }

    // 3. OCR the already-redacted image to rebuild a searchable text layer.
    //    Blacked-out regions have no legible pixels, so nothing there is
    //    recognized — the removed text can't reappear in the text layer.
    let words: Awaited<ReturnType<typeof ocrImage>> = [];
    try {
      words = await ocrImage(redactedPath, signal);
    } catch {
      // OCR is a best-effort enhancement; if it fails the page still redacts
      // correctly (image only), just without a searchable layer.
      words = [];
    }

    // 4. Place the flattened image on a new page sized in points, then draw the
    //    OCR words invisibly on top at their positions.
    const pngBytes = await fs.readFile(redactedPath);
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

    await fs.rm(redactedPath, { force: true });
  }

  if (signal.aborted) throw new Error("cancelled");
  await onProgress("finishing", 92);

  const outputName = `zenfyle-redact-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);
  const outBytes = await out.save();
  await fs.writeFile(outputPath, outBytes);

  await onProgress("finishing", 100);

  const areaWord = boxes.length === 1 ? "area" : "areas";
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Permanently removed ${boxes.length} ${areaWord} and rebuilt the document.`,
    note: "The marked content is permanently removed — flattened out of the pixels and absent from the text layer, so it can't be recovered from this file. Other text was re-recognized with OCR and stays searchable.",
  };
}
