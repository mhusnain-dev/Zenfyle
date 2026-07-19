/*
 * Shared contract for client-side tool processors (Section 11.5 "Client"
 * tools). Each processor is one file in lib/processors/ and is registered in
 * lib/processors/index.ts — the ToolPageClient/useToolJob machine looks the
 * processor up by slug, so adding a tool never edits a shared conditional
 * (same single-source rule as the registry, Section 4.3).
 */

export type ProcessOptions = Record<string, unknown>;

export type ProcessInput = {
  files: File[];
  options: ProcessOptions;
};

export type OutputFile = {
  /** The produced file, ready to hand to a download link. */
  blob: Blob;
  /** Output name — the zenfyle-{slug}-{shortId}[-pNN].{ext} convention (13.8). */
  filename: string;
};

export type ProcessResult = {
  /**
   * One or more produced files. Single-output tools return one; multi-output
   * tools (e.g. Split) return many. The >3-files ZIP rule (Section 6) is
   * applied centrally after the processor returns — processors always return
   * the raw per-file list here, never a pre-zipped bundle.
   */
  outputs: OutputFile[];
  /** Human summary for the result screen, e.g. "12 pages merged into 1 file". */
  summary: string;
  /**
   * Optional secondary note for the result screen — e.g. Compress reporting the
   * file was already optimally sized and returned unchanged (Section 11.6).
   */
  note?: string;
};

/** Report coarse progress (0–100) and an honest status label (Section 4.2 step 3). */
export type ProgressReporter = (percent: number, label: string) => void;

export type Processor = (
  input: ProcessInput,
  onProgress: ProgressReporter,
  signal: AbortSignal,
) => Promise<ProcessResult>;

/*
 * Raised by a processor when the input exceeds what the client path can safely
 * handle (Section 11.6: Merge's 5-file / 100 MB client cap). The UI turns this
 * into the "this will use server processing" path rather than a hard error —
 * the server path itself is wired in Phase 6.
 */
export class ClientLimitExceeded extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientLimitExceeded";
  }
}
