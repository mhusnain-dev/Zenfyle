import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { ProcessingError } from "./types";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
} from "./types";
import { extractPositionedText } from "./pdf-text";
import { ocrPdf } from "./ocr";

/*
 * PDF to Excel adapter (Section 11.5, spec v1.4.3). Table extraction is
 * inherently BEST-EFFORT — a PDF stores positioned glyphs, not a table model —
 * so this reconstructs a grid from word geometry and carries an honest note.
 *
 * Why not LibreOffice: the frozen spec's processing matrix listed "LibreOffice
 * headless" for this tool, but LibreOffice has NO PDF→Calc import filter — that
 * line was wrong (corrected in specs.md v1.4.3). Faking it would violate the
 * anti-hallucination rule (§592), which is why the tool sat comingSoon.
 *
 * Two input paths, chosen per page:
 *   - Digital text layer present  → extractPositionedText (pdfjs, no OCR).
 *   - Scanned / image-only page   → OCR fallback (ocrPdf → Tesseract).
 * Either way we get positioned words, cluster them into rows and columns by
 * geometry, and write one worksheet per page with exceljs. If NOTHING is
 * extractable anywhere, we fail explicitly (UNSUPPORTED_FILE_TYPE) rather than
 * emit an empty spreadsheet (§592 "when uncertain, fail explicitly").
 */

/** Below this confidence an OCR word is treated as noise and dropped. */
const MIN_OCR_CONF = 40;
/** A page needs at least this many digital words to skip the OCR fallback. */
const MIN_DIGITAL_WORDS = 4;

type Word = { text: string; x: number; y: number; width: number; height: number };

/** Median of a numeric array (0 for empty). */
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Cluster positioned words into a grid of rows × columns.
 *
 * Rows: words are grouped by vertical center — a word joins the current row
 * while its center stays within ~60% of the median word height of the row's
 * center, otherwise it opens a new row (top to bottom).
 *
 * Columns: word left-edges across the whole page are clustered on the x axis
 * (1D, gap-based) into column anchors; each word then lands in the nearest
 * anchor. Words colliding in one cell are joined left-to-right with a space.
 * This recovers clean grids well and degrades gracefully on irregular layouts —
 * hence the honest "review the result" note on the tool.
 */
function wordsToGrid(words: Word[], pageWidth: number): string[][] {
  if (words.length === 0) return [];

  const h = median(words.map((w) => w.height)) || 1;

  // --- Rows: sort by vertical center, group within tolerance. ---
  const withCenter = words
    .map((w) => ({ ...w, cy: w.y + w.height / 2 }))
    .sort((a, b) => a.cy - b.cy);
  const rowTol = h * 0.6;
  const rows: (typeof withCenter)[] = [];
  for (const w of withCenter) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(w.cy - (last[0].cy + last[last.length - 1].cy) / 2) <= rowTol) {
      last.push(w);
    } else {
      rows.push([w]);
    }
  }

  // --- Columns: cluster all word left-edges on the x axis. ---
  const lefts = [...words].map((w) => w.x).sort((a, b) => a - b);
  const colGap = Math.max(pageWidth * 0.015, (median(words.map((w) => w.width)) || 1) * 0.75);
  const anchors: number[] = [];
  let clusterStart = lefts[0];
  let clusterVals: number[] = [lefts[0]];
  for (let i = 1; i < lefts.length; i++) {
    if (lefts[i] - lefts[i - 1] > colGap) {
      anchors.push(clusterVals.reduce((s, v) => s + v, 0) / clusterVals.length);
      clusterVals = [];
      clusterStart = lefts[i];
    }
    clusterVals.push(lefts[i]);
  }
  if (clusterVals.length) {
    anchors.push(clusterVals.reduce((s, v) => s + v, 0) / clusterVals.length);
  }
  void clusterStart;

  const nearestCol = (x: number): number => {
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < anchors.length; c++) {
      const dist = Math.abs(anchors[c] - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  };

  // --- Assemble the grid. ---
  const grid: string[][] = [];
  for (const row of rows) {
    const cells: string[] = new Array(anchors.length).fill("");
    for (const w of [...row].sort((a, b) => a.x - b.x)) {
      const c = nearestCol(w.x);
      cells[c] = cells[c] ? `${cells[c]} ${w.text}` : w.text;
    }
    // Drop trailing empty columns so a ragged row doesn't pad the sheet.
    let end = cells.length;
    while (end > 0 && cells[end - 1] === "") end--;
    grid.push(cells.slice(0, end));
  }
  return grid;
}

export async function pdfToExcel(
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> {
  await onProgress("reading", 10);

  const data = new Uint8Array(await fs.readFile(input.inputPath));

  // Page count via pdf-lib (already a dependency); also catches corrupt PDFs.
  let pageCount: number;
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: false });
    pageCount = doc.getPageCount();
  } catch (err) {
    throw new ProcessingError(
      "This PDF couldn't be read. It may be corrupted or password-protected.",
      { code: "FILE_CORRUPTED", cause: err },
    );
  }

  await onProgress("extracting", 30);

  // Digital text layer first (cheap, no OCR).
  const digital = await extractPositionedText(data);
  if (signal.aborted) throw new Error("cancelled");

  // Pages needing OCR (little or no digital text = scanned/image page).
  const ocrPageNums = digital
    .filter((p) => p.words.length < MIN_DIGITAL_WORDS)
    .map((p) => p.page);

  // Per-page words in a common {x,y,width,height} space (points for digital;
  // for OCR we scale image pixels back to the digital page's point size so a
  // mixed document stays consistent — but each page is gridded independently,
  // so absolute units only need to be self-consistent per page).
  const perPageWords = new Map<number, { words: Word[]; pageWidth: number }>();
  for (const p of digital) {
    if (p.words.length >= MIN_DIGITAL_WORDS) {
      perPageWords.set(p.page, { words: p.words, pageWidth: p.pageWidth });
    }
  }

  let usedOcr = false;
  if (ocrPageNums.length > 0) {
    usedOcr = true;
    await onProgress("recognizing", 45);
    // OCR renders + reads only the scanned pages. Each returns pixel-space
    // words; we keep them in pixels and pass the image width as pageWidth.
    const ocrPages = await ocrPdf(input.inputPath, pageCount, input.workDir, signal);
    for (const op of ocrPages) {
      if (!ocrPageNums.includes(op.page)) continue; // skip pages we got digitally
      const words: Word[] = op.words
        .filter((w) => w.conf >= MIN_OCR_CONF)
        .map((w) => ({
          text: w.text,
          x: w.left,
          y: w.top,
          width: w.width,
          height: w.height,
        }));
      perPageWords.set(op.page, { words, pageWidth: op.imageWidth });
    }
  }

  if (signal.aborted) throw new Error("cancelled");
  await onProgress("building", 75);

  // Build the workbook: one worksheet per page that yielded any words.
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zenfyle";
  let totalRows = 0;
  let sheetsWithData = 0;

  for (let p = 1; p <= pageCount; p++) {
    const entry = perPageWords.get(p);
    const grid = entry ? wordsToGrid(entry.words, entry.pageWidth) : [];
    const sheet = workbook.addWorksheet(`Page ${p}`);
    for (const row of grid) {
      sheet.addRow(row);
      totalRows++;
    }
    if (grid.length > 0) sheetsWithData++;
  }

  if (sheetsWithData === 0) {
    throw new ProcessingError(
      "No tables or text could be extracted from this PDF. It may be blank, or an image with text too unclear to recognize.",
      { code: "UNSUPPORTED_FILE_TYPE" },
    );
  }

  await onProgress("finishing", 90);

  const outputName = `zenfyle-pdf-to-excel-${input.shortId}.xlsx`;
  const outputPath = path.join(input.workDir, outputName);
  await workbook.xlsx.writeFile(outputPath);

  await onProgress("finishing", 100);

  const pageWord = sheetsWithData === 1 ? "page" : "pages";
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Extracted ${totalRows} rows across ${sheetsWithData} ${pageWord} into a spreadsheet.`,
    note: usedOcr
      ? "Some pages had no text layer and were read with OCR. Table structure is reconstructed from layout and is best-effort — check the columns and rows before relying on the data."
      : "Table structure is reconstructed from the PDF layout and is best-effort — check the columns and rows before relying on the data.",
  };
}
