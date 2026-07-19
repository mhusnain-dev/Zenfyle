import { StandardFonts, rgb } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Add Page Numbers — Section 11.5 (client, pdf-lib) + 11.6. Stamps a page
 * number onto every page in Helvetica, at one of six positions (three
 * horizontal alignments × top/bottom). Optionally starts numbering at a chosen
 * value and can show "n of N". No colour/font pickers for MVP — a single clean
 * default keeps the tool honest about what it does.
 */
const SLUG = "add-page-numbers";

type Position =
  | "bottom-center"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "top-right"
  | "top-left";

const MARGIN = 28; // points from the page edge
const FONT_SIZE = 11;

export const addPageNumbers: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF.");

  const position = (input.options.position as Position) ?? "bottom-center";
  const startAt = Number(input.options.startAt ?? 1) || 1;
  const showTotal = Boolean(input.options.showTotal ?? false);

  onProgress(20, "Reading PDF");
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  onProgress(55, "Stamping page numbers");
  pages.forEach((page, i) => {
    const num = startAt + i;
    const label = showTotal ? `${num} of ${startAt + total - 1}` : `${num}`;
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, FONT_SIZE);

    const isTop = position.startsWith("top");
    const y = isTop ? height - MARGIN - FONT_SIZE : MARGIN;

    let x: number;
    if (position.endsWith("left")) x = MARGIN;
    else if (position.endsWith("right")) x = width - MARGIN - textWidth;
    else x = (width - textWidth) / 2;

    page.drawText(label, {
      x,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  });

  onProgress(90, "Writing PDF");
  const blob = await toPdfBlob(doc);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Added page numbers to ${total} page${total === 1 ? "" : "s"}`,
  };
};
