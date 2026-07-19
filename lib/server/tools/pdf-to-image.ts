import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ProcessingError,
  type ServerOutputFile,
  type ServerProcessInput,
  type ServerProcessResult,
  type ServerProgressReporter,
  type ServerProcessor,
} from "./types";

/*
 * PDF → raster image rendering (Section 11.5) — a Ghostscript spawn point
 * (adapter pattern, Section 11.1/585) shared by pdf-to-jpg and pdf-to-png. One
 * output image per PDF page, so this is the first MULTI-output server tool: the
 * pipeline's packageAndStore() ZIPs anything with >1 output into a single
 * download (the ZIP path that was previously unexercised — PROGRESS.md note).
 *
 * gs writes one file per page via a "%03d" filename template:
 *   gs -sDEVICE=jpeg|png16m -r150 -o out-%03d.ext in.pdf
 * We render at 150 DPI (a reasonable screen/pre-print default; not a user option
 * for MVP, matching the NoOptions registry entry). Output names follow the spec
 * convention zenfyle-{slug}-{shortId}-pNN.{ext} after gs finishes.
 */

const RENDER_DPI = 150;

type GsDevice = { device: string; ext: string };

const DEVICES: Record<"jpg" | "png", GsDevice> = {
  jpg: { device: "jpeg", ext: "jpg" },
  png: { device: "png16m", ext: "png" }, // png16m = 24-bit RGB PNG
};

function runGhostscript(
  args: string[],
  signal: AbortSignal,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const gs = spawn("gs", args, { signal });
    let stderr = "";
    gs.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    gs.on("error", (err) => reject(err));
    gs.on("close", (code) => resolve({ code, stderr }));
  });
}

/**
 * Build a ServerProcessor that rasterizes each PDF page to `format` images.
 * pdf-to-jpg and pdf-to-png are one line each on top of this.
 */
export function makePdfToImageConverter(
  slug: string,
  format: "jpg" | "png",
): ServerProcessor {
  const { device, ext } = DEVICES[format];

  return async (
    input: ServerProcessInput,
    onProgress: ServerProgressReporter,
    signal: AbortSignal,
  ): Promise<ServerProcessResult> => {
    await onProgress("rendering", 20);

    // gs expands "%03d" to the 1-based page number; the temp names are renamed
    // to the spec convention below once we know the count.
    const tmpTemplate = path.join(input.workDir, `page-%03d.${ext}`);
    const args = [
      "-sDEVICE=" + device,
      `-r${RENDER_DPI}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      "-dPDFSTOPONERROR", // fail (not prompt) on an encrypted/broken PDF
      `-sOutputFile=${tmpTemplate}`,
      input.inputPath,
    ];

    let result: { code: number | null; stderr: string };
    try {
      result = await runGhostscript(args, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      throw new ProcessingError("Couldn't render this PDF to images.", {
        cause: err,
      });
    }

    if (signal.aborted) throw new Error("cancelled");

    if (result.code !== 0) {
      throw new ProcessingError(
        "This PDF couldn't be converted — it may be password-protected or damaged. Try Unlock PDF first.",
        { code: "FILE_CORRUPTED", cause: result.stderr },
      );
    }

    // Collect the rendered pages in order and rename to the spec convention.
    const rendered = (await fs.readdir(input.workDir))
      .filter((f) => f.startsWith("page-") && f.endsWith(`.${ext}`))
      .sort();

    if (rendered.length === 0) {
      throw new ProcessingError(
        "This PDF couldn't be converted — no pages were produced.",
        { code: "FILE_CORRUPTED", cause: result.stderr },
      );
    }

    await onProgress("packaging", 80);

    const outputs: ServerOutputFile[] = [];
    for (let i = 0; i < rendered.length; i++) {
      const pageNum = String(i + 1).padStart(2, "0");
      const filename = `zenfyle-${slug}-${input.shortId}-p${pageNum}.${ext}`;
      const outputPath = path.join(input.workDir, filename);
      await fs.rename(path.join(input.workDir, rendered[i]), outputPath);
      outputs.push({ path: outputPath, filename });
    }

    await onProgress("finishing", 100);

    const pageWord = outputs.length === 1 ? "page" : "pages";
    return {
      outputs,
      summary: `Converted ${outputs.length} ${pageWord} to ${format.toUpperCase()} ${
        outputs.length === 1 ? "image" : "images"
      }.`,
    };
  };
}
