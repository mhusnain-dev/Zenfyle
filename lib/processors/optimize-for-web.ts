import imageCompression from "browser-image-compression";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Optimize for Web — Section 11.5 (client, browser-image-compression) + 11.6.
 * Converts an image to WebP, the modern web-delivery format (smaller than
 * JPEG/PNG at equivalent quality). Reuses the shared Compress presets for the
 * quality target; unlike Compress Image (which preserves the source format),
 * this one always emits .webp (registry outputExtension), since the whole point
 * is the format switch. Also caps very large dimensions at 2048px, a sensible
 * web ceiling.
 */
const SLUG = "optimize-for-web";

const PRESETS: Record<string, number> = {
  low: 0.8, // lightest compression, best quality
  medium: 0.7,
  high: 0.5, // smallest file
};

export const optimizeForWeb: Processor = async (input, onProgress, signal) => {
  const file = input.files[0];
  if (!file) throw new Error("Add an image to optimize.");

  const preset = (input.options.preset as string) ?? "medium";
  const quality = PRESETS[preset] ?? PRESETS.medium;

  onProgress(15, "Preparing image");

  const optimized = await imageCompression(file, {
    initialQuality: quality,
    useWebWorker: true,
    fileType: "image/webp",
    maxWidthOrHeight: 2048,
    signal,
    onProgress: (p: number) =>
      onProgress(15 + Math.round((p / 100) * 80), "Converting to WebP"),
  });

  onProgress(100, "Done");

  const filename = outputFilename(SLUG, "webp");
  const delta = 1 - optimized.size / file.size;
  const summary =
    delta > 0.01
      ? `Converted to WebP, ${Math.round(delta * 100)}% smaller (${formatKb(file.size)} → ${formatKb(optimized.size)})`
      : `Converted to WebP (${formatKb(optimized.size)})`;

  return {
    outputs: [{ blob: optimized, filename }],
    summary,
    note:
      delta <= 0.01
        ? "WebP wasn't smaller for this image, but it's the more web-friendly format for modern browsers."
        : undefined,
  };
};

function formatKb(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
