import { PDFDocument } from "pdf-lib";
import { toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * JPG to PDF — Section 11.5 (client, pdf-lib). Wrap a JPG into a single-page
 * PDF whose page is sized exactly to the image (points = pixels at 72 DPI), so
 * the picture fills the page with no borders or distortion. Registry accepts a
 * single .jpg/.jpeg (acceptsMultipleFiles: false), so this is one page out.
 */
const SLUG = "jpg-to-pdf";

export const jpgToPdf: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a JPG image.");

  onProgress(20, "Reading image");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const doc = await PDFDocument.create();

  onProgress(55, "Embedding image");
  let image;
  try {
    image = await doc.embedJpg(bytes);
  } catch {
    throw new Error(
      `"${file.name}" couldn't be read as a JPG. It may be corrupted or a different format.`,
    );
  }

  const page = doc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  onProgress(90, "Writing PDF");
  const blob = await toPdfBlob(doc);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: "Wrapped the image into a PDF",
  };
};
