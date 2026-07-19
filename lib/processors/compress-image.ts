import imageCompression from "browser-image-compression";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Compress Image — Section 11.5 (client, browser-image-compression) + 11.6:
 * three presets (Low / Medium / High compression), no manual slider. Higher
 * compression = lower quality/smaller file. Output keeps the source extension
 * (registry outputExtension is "" for image tools, Section 4).
 *
 * Section 11.6 "never larger than input" rule: if the compressed result is
 * bigger than the original (a real behavior on already-optimized files),
 * silently return the original and note it on the result screen.
 */
const SLUG = "compress-image";

// initialQuality is the lossy target; lower = more compression.
const PRESETS: Record<string, number> = {
  low: 0.8, // low compression, high quality
  medium: 0.6,
  high: 0.4, // high compression, smaller file
};

function extFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) return fromName;
  // Fall back to MIME if the name has no usable extension.
  return file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : "jpg";
}

export const compressImage: Processor = async (input, onProgress, signal) => {
  const file = input.files[0];
  if (!file) throw new Error("Add an image to compress.");

  const preset = (input.options.preset as string) ?? "medium";
  const quality = PRESETS[preset] ?? PRESETS.medium;

  onProgress(15, "Preparing image");

  const compressed = await imageCompression(file, {
    initialQuality: quality,
    useWebWorker: true,
    // Preserve the original format rather than forcing everything to JPEG.
    fileType: file.type || undefined,
    signal,
    onProgress: (p: number) =>
      onProgress(15 + Math.round((p / 100) * 80), "Compressing"),
  });

  onProgress(98, "Finishing");

  const ext = extFor(file);
  const filename = outputFilename(SLUG, ext);

  // Never return a larger file than the input (Section 11.6).
  if (compressed.size >= file.size) {
    onProgress(100, "Done");
    return {
      outputs: [{ blob: file, filename }],
      summary: `${file.name} is already optimally sized`,
      note: "This image was already well optimized, so we kept the original — compressing further would have made it larger.",
    };
  }

  const saved = Math.round((1 - compressed.size / file.size) * 100);
  onProgress(100, "Done");
  return {
    outputs: [{ blob: compressed, filename }],
    summary: `Reduced size by ${saved}% (${formatKb(file.size)} → ${formatKb(compressed.size)})`,
  };
};

function formatKb(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
