import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Sign PDF — Section 11.5 (client, pdf-lib) + 11.6: draw-with-mouse/touch
 * signature only for MVP (typed/uploaded signatures are later additions). The
 * SignOptions component captures the drawn strokes as a transparent PNG data
 * URL and passes it in options.signature, along with which page to sign and a
 * corner to anchor it in. Here we decode that PNG, embed it, and stamp it onto
 * the chosen page — pdf-lib preserves the alpha channel so only the ink shows.
 */
const SLUG = "sign-pdf";

// Signature occupies this fraction of the page width; height follows the
// drawn aspect ratio. A comfortable size for a corner signature.
const SIG_WIDTH_RATIO = 0.28;
const MARGIN = 36; // points from the page edge

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const signPdf: Processor = async (input, onProgress, signal) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF to sign.");

  const signature = input.options.signature as string | undefined;
  if (!signature) {
    throw new Error("Draw your signature first, then sign the PDF.");
  }

  const corner = (input.options.corner as Corner) ?? "bottom-right";
  const pageChoice = (input.options.page as number) ?? 0; // 0 = last page

  onProgress(20, "Reading PDF");
  const pdf = await loadPdf(file);
  if (signal.aborted) throw new Error("cancelled");

  const pages = pdf.getPages();
  // page is 1-based from the UI; 0 (default) means the last page.
  const index =
    pageChoice > 0 ? Math.min(pageChoice, pages.length) - 1 : pages.length - 1;
  const page = pages[index];

  onProgress(55, "Embedding signature");
  const png = await pdf.embedPng(dataUrlToBytes(signature));
  if (signal.aborted) throw new Error("cancelled");

  const { width: pw, height: ph } = page.getSize();
  const sigW = pw * SIG_WIDTH_RATIO;
  const sigH = sigW * (png.height / png.width);

  const x = corner.endsWith("right") ? pw - sigW - MARGIN : MARGIN;
  const y = corner.startsWith("top") ? ph - sigH - MARGIN : MARGIN;

  page.drawImage(png, { x, y, width: sigW, height: sigH });

  onProgress(85, "Saving");
  const blob = await toPdfBlob(pdf);

  onProgress(100, "Done");
  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Signed page ${index + 1} of ${pages.length}`,
  };
};
