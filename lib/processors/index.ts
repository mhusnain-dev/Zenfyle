import type { Processor } from "@/lib/processors/types";
import { mergePdf } from "@/lib/processors/merge-pdf";
import { splitPdf } from "@/lib/processors/split-pdf";
import { rotatePdf } from "@/lib/processors/rotate-pdf";
import { organizePages } from "@/lib/processors/organize-pages";
import { removePages } from "@/lib/processors/remove-pages";
import { compressImage } from "@/lib/processors/compress-image";
import { extractPages } from "@/lib/processors/extract-pages";
import { jpgToPdf } from "@/lib/processors/jpg-to-pdf";
import { addPageNumbers } from "@/lib/processors/add-page-numbers";
import { addWatermark } from "@/lib/processors/add-watermark";
import { optimizeForWeb } from "@/lib/processors/optimize-for-web";
import { signPdf } from "@/lib/processors/sign-pdf";
import { fillPdfForm } from "@/lib/processors/fill-pdf-form";
import { editPdf } from "@/lib/processors/edit-pdf";

/*
 * Client-side processor lookup (Section 4.3 / 11.5). Maps a tool slug to its
 * processing function; the tool page machine looks the processor up here by
 * slug — no if/else chain. Adding a client tool = one entry here + one file.
 * A slug with no entry has no client processor yet (server-side or unbuilt).
 */
const PROCESSORS: Record<string, Processor> = {
  "merge-pdf": mergePdf,
  "split-pdf": splitPdf,
  "rotate-pdf": rotatePdf,
  "organize-pages": organizePages,
  "remove-pages": removePages,
  "compress-image": compressImage,
  "extract-pages": extractPages,
  "jpg-to-pdf": jpgToPdf,
  "add-page-numbers": addPageNumbers,
  "add-watermark": addWatermark,
  "optimize-for-web": optimizeForWeb,
  "sign-pdf": signPdf,
  "fill-pdf-form": fillPdfForm,
  "edit-pdf": editPdf,
};

export function getProcessor(slug: string): Processor | undefined {
  return PROCESSORS[slug];
}
