import { StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";
import type { Annotation } from "@/lib/processors/annotations";

/*
 * Annotate PDF — slug `edit-pdf`, Section 11.5 (client, pdf-lib annotation
 * layer). Scope is locked by §4.1c: we ADD markup on top of the page
 * (highlights, text boxes/callouts, freehand ink). We never touch the
 * underlying page text — pdf-lib draws a new layer, it does not reflow or
 * delete existing content.
 *
 * The editor passes annotations in normalized top-left coordinates (see
 * annotations.ts). This is the single place that converts to pdf-lib's
 * bottom-left point space, so the UI never deals with PDF geometry.
 */
const SLUG = "edit-pdf";

/** hex "#rrggbb" -> pdf-lib rgb() in 0..1, defaulting to black on bad input. */
function hexColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return rgb(0, 0, 0);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function drawOne(
  page: PDFPage,
  font: PDFFont,
  ann: Annotation,
  pw: number,
  ph: number,
) {
  const color = hexColor(ann.color);

  if (ann.type === "highlight") {
    // Semi-transparent block over the text it marks. y flips: the top-left
    // normalized y becomes a bottom-left origin, minus the block height.
    page.drawRectangle({
      x: ann.x * pw,
      y: ph - (ann.y + ann.height) * ph,
      width: ann.width * pw,
      height: ann.height * ph,
      color,
      opacity: 0.35,
    });
    return;
  }

  if (ann.type === "text") {
    // Text is drawn from its baseline; the normalized y marks the top of the
    // text, so drop by roughly the cap height (the font size) to land it.
    page.drawText(ann.text, {
      x: ann.x * pw,
      y: ph - ann.y * ph - ann.size,
      size: ann.size,
      font,
      color,
    });
    return;
  }

  // ink: connect consecutive normalized points with straight segments. A
  // dense point list from a freehand drag reads as a smooth curve.
  const pts = ann.points;
  for (let i = 1; i < pts.length; i++) {
    page.drawLine({
      start: { x: pts[i - 1].x * pw, y: ph - pts[i - 1].y * ph },
      end: { x: pts[i].x * pw, y: ph - pts[i].y * ph },
      thickness: ann.width,
      color,
    });
  }
}

export const editPdf: Processor = async (input, onProgress, signal) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF to annotate.");

  const annotations = (input.options.annotations as Annotation[]) ?? [];
  if (annotations.length === 0) {
    throw new Error("Add at least one markup (highlight, text, or drawing) first.");
  }

  onProgress(20, "Reading PDF");
  const pdf = await loadPdf(file);
  if (signal.aborted) throw new Error("cancelled");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  onProgress(55, "Applying markup");
  for (const ann of annotations) {
    const page = pages[ann.page - 1];
    if (!page) continue; // annotation for a page that no longer exists — skip
    const { width, height } = page.getSize();
    drawOne(page, font, ann, width, height);
  }
  if (signal.aborted) throw new Error("cancelled");

  onProgress(85, "Saving");
  const blob = await toPdfBlob(pdf);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Added ${annotations.length} markup${annotations.length === 1 ? "" : "s"}`,
  };
};
