import { degrees } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Rotate PDF — Section 11.5 (client, pdf-lib) + 11.6: 90° increments only
 * (90/180/270), applied to every page. Rotation is added to each page's
 * existing rotation so a pre-rotated page rotates correctly, then normalized
 * to 0-359.
 */
const SLUG = "rotate-pdf";

export const rotatePdf: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF to rotate.");

  const turn = Number(input.options.degrees ?? 90);
  if (![90, 180, 270].includes(turn))
    throw new Error("Choose a rotation of 90, 180, or 270 degrees.");

  onProgress(20, "Reading PDF");
  const doc = await loadPdf(file);

  const pages = doc.getPages();
  pages.forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + turn) % 360));
  });

  onProgress(90, "Writing rotated PDF");
  const blob = await toPdfBlob(doc);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Rotated ${pages.length} page${pages.length === 1 ? "" : "s"} by ${turn}°`,
  };
};
