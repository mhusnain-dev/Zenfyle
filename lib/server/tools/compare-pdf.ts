import { promises as fs } from "node:fs";
import path from "node:path";
import { diffWords, type Change } from "diff";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
} from "./types";
import { ProcessingError } from "./types";
import { extractPdfText, assertHasText } from "./pdf-text";

/*
 * Compare PDF (§251, server-side). Extracts the text layer of two PDFs and
 * produces a word-level diff, rendered as a readable PDF report:
 *   • removed text (only in the first doc)  → red, struck through
 *   • added text   (only in the second doc) → green, underlined
 *   • unchanged text                        → grey
 *
 * Scope (§4.1c): this is a TEXT diff, not a visual/pixel diff, and scanned
 * (image-only) PDFs are rejected up front — they have no text layer to compare
 * (see assertHasText). We diff the whole-document text (pages concatenated) so
 * content that merely moved across a page break still reads as unchanged.
 */

// Report page geometry (US Letter, points) and layout constants.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const LINE_H = 14;
const HEADING_SIZE = 18;

// Diff colors.
const RED = rgb(0.72, 0.11, 0.18); // removed
const GREEN = rgb(0.13, 0.5, 0.23); // added
const GREY = rgb(0.25, 0.25, 0.25); // unchanged
const MUTED = rgb(0.4, 0.4, 0.4);

export async function comparePdf(
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> {
  if (!input.secondInputPath) {
    // Should never happen: the route rejects a compare job without file2. This
    // guards the adapter contract so a misuse fails loudly, not with a wrong diff.
    throw new ProcessingError("Compare PDF needs two files, but only one was received.");
  }

  const abortIfCancelled = () => {
    if (signal.aborted) throw new Error("cancelled");
  };

  await onProgress("processing", 15);
  const [bufA, bufB] = await Promise.all([
    fs.readFile(input.inputPath),
    fs.readFile(input.secondInputPath),
  ]);

  // Extract text from both. Reject scanned/image-only PDFs (§251). Check for
  // cancellation between the two extractions — each can be slow on a big PDF.
  await onProgress("processing", 30);
  const textA = await extractPdfText(new Uint8Array(bufA));
  assertHasText(textA, "first");
  abortIfCancelled();
  await onProgress("processing", 50);
  const textB = await extractPdfText(new Uint8Array(bufB));
  assertHasText(textB, "second");
  abortIfCancelled();

  // Word-level diff of the whole-document text.
  await onProgress("processing", 65);
  const docA = textA.pages.map((p) => p.text).join("\n");
  const docB = textB.pages.map((p) => p.text).join("\n");
  const changes = diffWords(docA, docB);

  const stats = summarize(changes);

  // Render the report.
  await onProgress("finalizing", 80);
  const pdfBytes = await renderReport(changes, stats);

  const outputName = `zenfyle-compare-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);
  await fs.writeFile(outputPath, pdfBytes);
  await onProgress("finalizing", 100);

  // `summary` = the outcome (how much changed), shown as the result headline.
  // `note` = the scope caveat, shown as an advisory beneath it. These reach the
  // result screen on distinct channels now (resultSummary vs errorMessage).
  const summary =
    stats.added === 0 && stats.removed === 0
      ? "No text differences found — the two documents have identical text."
      : `Found ${stats.removed} removed and ${stats.added} added word${
          stats.added + stats.removed === 1 ? "" : "s"
        }. See the report for details.`;

  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary,
    note: "This is a text-level comparison: it diffs extractable text, not layout, fonts, or images.",
  };
}

type Stats = { added: number; removed: number };

/** Count added/removed words (a "word" = whitespace-delimited token) for the summary. */
function summarize(changes: Change[]): Stats {
  let added = 0;
  let removed = 0;
  for (const c of changes) {
    if (!c.added && !c.removed) continue;
    const words = c.value.trim().split(/\s+/).filter(Boolean).length;
    if (c.added) added += words;
    else if (c.removed) removed += words;
  }
  return { added, removed };
}

/*
 * Render the diff to a multi-page PDF. We lay out tokens left-to-right with a
 * simple word-wrap, tracking color per segment and drawing a strike/underline
 * decoration for removed/added runs. Helvetica (WinAnsi) can't encode arbitrary
 * Unicode, so text is sanitized to the encodable range to avoid a pdf-lib throw.
 */
async function renderReport(changes: Change[], stats: Stats): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const maxX = PAGE_W - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensureRoom = () => {
    if (y < MARGIN + LINE_H) newPage();
  };

  // --- header ---
  page.drawText("PDF Comparison", { x: MARGIN, y: y - HEADING_SIZE, size: HEADING_SIZE, font: bold, color: GREY });
  y -= HEADING_SIZE + 8;
  page.drawText(
    `${stats.removed} removed · ${stats.added} added`,
    { x: MARGIN, y: y - FONT_SIZE, size: FONT_SIZE, font, color: MUTED },
  );
  y -= LINE_H;
  // Legend.
  page.drawText("Red struck = removed from first    Green underline = added in second", {
    x: MARGIN,
    y: y - FONT_SIZE,
    size: 9,
    font,
    color: MUTED,
  });
  y -= LINE_H * 1.5;

  // --- diff body ---
  let x = MARGIN;
  const spaceW = font.widthOfTextAtSize(" ", FONT_SIZE);

  for (const change of changes) {
    const color = change.added ? GREEN : change.removed ? RED : GREY;
    const decorate = change.added ? "underline" : change.removed ? "strike" : "none";
    // Split into words so we can wrap; keep explicit newlines as line breaks.
    const tokens = sanitize(change.value).split(/(\s+)/);
    for (const tok of tokens) {
      if (tok === "") continue;
      if (/^\s+$/.test(tok)) {
        // Whitespace: advance, or wrap on an embedded newline.
        if (tok.includes("\n")) {
          x = MARGIN;
          y -= LINE_H;
          ensureRoom();
        } else {
          x += spaceW * tok.length;
        }
        continue;
      }
      const w = font.widthOfTextAtSize(tok, FONT_SIZE);
      if (x + w > maxX) {
        x = MARGIN;
        y -= LINE_H;
        ensureRoom();
      }
      page.drawText(tok, { x, y: y - FONT_SIZE, size: FONT_SIZE, font, color });
      if (decorate === "strike") {
        const sy = y - FONT_SIZE + FONT_SIZE * 0.35;
        page.drawLine({ start: { x, y: sy }, end: { x: x + w, y: sy }, thickness: 0.6, color });
      } else if (decorate === "underline") {
        const uy = y - FONT_SIZE - 1.5;
        page.drawLine({ start: { x, y: uy }, end: { x: x + w, y: uy }, thickness: 0.6, color });
      }
      x += w + spaceW;
    }
  }

  return pdf.save();
}

/*
 * Helvetica's WinAnsi encoding can't represent arbitrary Unicode (e.g. smart
 * quotes, em dashes, CJK). Replace anything outside the encodable Latin-1 range
 * with "?" so drawText never throws mid-report. Newlines are preserved as the
 * word-wrapper treats them as hard breaks.
 */
function sanitize(s: string): string {
  return s.replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?");
}

export default comparePdf;
