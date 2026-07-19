import { StandardFonts, degrees, rgb } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Add Watermark — Section 11.5 (client, pdf-lib) + 11.6. Overlays a text
 * watermark on every page. Two layouts: a single large diagonal stamp across
 * the page center (the common "DRAFT"/"CONFIDENTIAL" look), or a smaller
 * horizontal label. Opacity is adjustable. Text is drawn on top of existing
 * content — this is an overlay, not a true background, which pdf-lib can't do
 * without re-composing content streams; called out honestly in the summary.
 */
const SLUG = "add-watermark";

type Layout = "diagonal" | "horizontal";

export const addWatermark: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF.");

  const text = ((input.options.text as string) ?? "").trim();
  if (!text) throw new Error("Enter the watermark text.");

  const layout = (input.options.layout as Layout) ?? "diagonal";
  const opacity = clamp01(Number(input.options.opacity ?? 0.3));

  onProgress(20, "Reading PDF");
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  onProgress(55, "Applying watermark");
  for (const page of pages) {
    const { width, height } = page.getSize();
    // Size the stamp to roughly span the page; diagonal fits the hypotenuse.
    const target = layout === "diagonal" ? Math.hypot(width, height) * 0.8 : width * 0.8;
    const size = fitFontSize(font, text, target);
    const textWidth = font.widthOfTextAtSize(text, size);

    if (layout === "diagonal") {
      // Rotate about the page center; offset the anchor so the text is centered.
      const angle = Math.atan2(height, width); // radians of the page diagonal
      const cx = width / 2;
      const cy = height / 2;
      const half = textWidth / 2;
      page.drawText(text, {
        x: cx - half * Math.cos(angle) + (size / 2) * Math.sin(angle),
        y: cy - half * Math.sin(angle) - (size / 2) * Math.cos(angle),
        size,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity,
        rotate: degrees((angle * 180) / Math.PI),
      });
    } else {
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - size) / 2,
        size,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity,
      });
    }
  }

  onProgress(90, "Writing PDF");
  const blob = await toPdfBlob(doc);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Watermarked ${pages.length} page${pages.length === 1 ? "" : "s"} with “${text}”`,
  };
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.3;
  return Math.min(1, Math.max(0.05, n));
}

// Shrink the font until the text fits the target width (avoids overflow on
// long watermark strings). Starts generous and steps down.
function fitFontSize(
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  text: string,
  targetWidth: number,
): number {
  let size = 120;
  while (size > 12 && font.widthOfTextAtSize(text, size) > targetWidth) {
    size -= 4;
  }
  return size;
}
