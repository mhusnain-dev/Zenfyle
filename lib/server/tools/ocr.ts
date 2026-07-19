import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ProcessingError } from "./types";

/*
 * OCR integration (Section 11.5, spec v1.4.3) — the ONE place `tesseract` is
 * invoked (adapter pattern, Section 11.1/585). Two tools consume it: redact-pdf
 * (rebuild a searchable text layer after flattening) and pdf-to-excel (recover
 * table text from scanned PDFs that have no digital text layer).
 *
 * Tesseract is a user-space install on this box (same .deb + dpkg-deb -x trick
 * as qpdf; see CLAUDE.md env notes). The `~/.local/bin/tesseract` wrapper sets
 * LD_LIBRARY_PATH + TESSDATA_PREFIX and is on PATH, so plain `spawn("tesseract")`
 * resolves it. No secrets flow through OCR, so args go on argv (unlike qpdf).
 *
 * Rendering a page to an image reuses the Ghostscript approach from
 * pdf-to-image.ts, but per-page (via -dFirstPage/-dLastPage) at a higher DPI —
 * OCR accuracy needs more resolution than screen display, so we render at 300.
 */

/** DPI for OCR rasterization. 300 is the accepted floor for reliable OCR. */
const OCR_DPI = 300;

/**
 * A single OCR'd word with its bounding box, in PIXELS of the rendered page
 * image (top-left origin). Callers normalize against the rendered page size.
 */
export type OcrWord = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Tesseract confidence 0–100; callers may drop low-confidence noise. */
  conf: number;
};

export type OcrPage = {
  /** 1-based page number. */
  page: number;
  /** Rendered image size in pixels — the coordinate space of `words`. */
  imageWidth: number;
  imageHeight: number;
  words: OcrWord[];
};

function run(
  cmd: string,
  args: string[],
  signal: AbortSignal,
): Promise<{ code: number | null; stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { signal });
    const stdout: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => stdout.push(d));
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) =>
      resolve({ code, stdout: Buffer.concat(stdout), stderr }),
    );
  });
}

/** Render one PDF page (1-based) to a PNG in `workDir`, returning its path. */
async function renderPage(
  inputPath: string,
  pageNum: number,
  workDir: string,
  signal: AbortSignal,
): Promise<string> {
  const outPath = path.join(workDir, `ocr-page-${pageNum}.png`);
  const args = [
    "-sDEVICE=png16m",
    `-r${OCR_DPI}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-dPDFSTOPONERROR",
    `-dFirstPage=${pageNum}`,
    `-dLastPage=${pageNum}`,
    `-sOutputFile=${outPath}`,
    inputPath,
  ];

  let result: { code: number | null; stderr: string };
  try {
    result = await run("gs", args, signal);
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ProcessingError("Couldn't render this PDF for text recognition.", {
      cause: err,
    });
  }
  if (signal.aborted) throw new Error("cancelled");
  if (result.code !== 0) {
    throw new ProcessingError(
      "This PDF couldn't be read — it may be password-protected or damaged. Try Unlock PDF first.",
      { code: "FILE_CORRUPTED", cause: result.stderr },
    );
  }
  return outPath;
}

/**
 * Parse tesseract's TSV output into words. TSV columns (tab-separated):
 *   level page_num block_num par_num line_num word_num left top width height conf text
 * Only `level == 5` rows are words; higher levels are page/block/line groupings
 * with empty text. Confidence -1 rows carry no text and are skipped.
 */
function parseTsv(tsv: string): OcrWord[] {
  const words: OcrWord[] = [];
  const lines = tsv.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 12) continue;
    if (cols[0] !== "5") continue; // level 5 = word
    const text = cols[11];
    if (!text || text.trim() === "") continue;
    const conf = Number(cols[10]);
    words.push({
      left: Number(cols[6]),
      top: Number(cols[7]),
      width: Number(cols[8]),
      height: Number(cols[9]),
      conf: Number.isFinite(conf) ? conf : 0,
      text,
    });
  }
  return words;
}

/** Read a PNG's pixel dimensions from its IHDR chunk (bytes 16–23, big-endian). */
async function pngSize(
  imagePath: string,
): Promise<{ width: number; height: number }> {
  const fh = await fs.open(imagePath, "r");
  try {
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    await fh.close();
  }
}

/**
 * OCR a single already-rendered image file to words (used by redact-pdf, which
 * has already rasterized+blacked-out the page and just needs its text layer).
 * Runs `tesseract <img> stdout tsv`.
 */
export async function ocrImage(
  imagePath: string,
  signal: AbortSignal,
): Promise<OcrWord[]> {
  let result: { code: number | null; stdout: Buffer; stderr: string };
  try {
    result = await run(
      "tesseract",
      [imagePath, "stdout", "--psm", "3", "tsv"],
      signal,
    );
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ProcessingError("Couldn't run text recognition on this file.", {
      cause: err,
    });
  }
  if (signal.aborted) throw new Error("cancelled");
  if (result.code !== 0) {
    throw new ProcessingError("Text recognition failed on this document.", {
      code: "WORKER_ERROR",
      cause: result.stderr,
    });
  }
  return parseTsv(result.stdout.toString("utf8"));
}

/**
 * Render + OCR every page of a PDF, returning per-page words with the rendered
 * image dimensions so callers can normalize the boxes. `maxPages` caps work on
 * huge documents. Used by pdf-to-excel's scanned-PDF fallback.
 */
export async function ocrPdf(
  inputPath: string,
  pageCount: number,
  workDir: string,
  signal: AbortSignal,
  onPage?: (page: number, total: number) => void | Promise<void>,
): Promise<OcrPage[]> {
  const pages: OcrPage[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (signal.aborted) throw new Error("cancelled");
    const imagePath = await renderPage(inputPath, p, workDir, signal);
    const words = await ocrImage(imagePath, signal);
    const { width, height } = await pngSize(imagePath);
    pages.push({ page: p, imageWidth: width, imageHeight: height, words });
    await onPage?.(p, pageCount);
    // Free the rendered page image; these are large at 300 DPI.
    await fs.rm(imagePath, { force: true });
  }
  return pages;
}

export { OCR_DPI, renderPage, pngSize };
