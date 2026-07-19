import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
  ServerProcessor,
} from "./types";
import { ProcessingError } from "./types";
import { decrypt, isEncrypted } from "./qpdf";

/*
 * Unlock PDF adapter (Section 11.5) — remove a password the user knows, via
 * qpdf. The password arrives out-of-band on `input.secret` (v1.4.1) and goes to
 * qpdf over stdin. If the PDF isn't actually encrypted we return it unchanged
 * with a friendly note rather than erroring (Section 11.6 "no-op" case, mirrors
 * compress's "already optimal"). A wrong password surfaces as INVALID_PASSWORD
 * so the client can re-prompt.
 */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const unlockPdf: ServerProcessor = async (
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> => {
  const outputName = `zenfyle-unlock-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);

  await onProgress("checking", 10);

  // Not encrypted? Nothing to remove — return the original with a note.
  if (!(await isEncrypted(input.inputPath, signal))) {
    await fs.copyFile(input.inputPath, outputPath);
    await onProgress("finishing", 100);
    const { size } = await fs.stat(outputPath);
    return {
      outputs: [{ path: outputPath, filename: outputName }],
      summary: `No password to remove (${fmtBytes(size)})`,
      note: "This PDF wasn't password-protected, so we returned it unchanged.",
    };
  }

  const password = input.secret ?? "";
  if (password.length === 0) {
    throw new ProcessingError("Enter the PDF's password to unlock it.", {
      code: "INVALID_PASSWORD",
    });
  }
  if (/[\r\n]/.test(password)) {
    throw new ProcessingError("The password can't contain line breaks.", {
      code: "INVALID_PASSWORD",
    });
  }

  await onProgress("unlocking", 40);
  await decrypt(input.inputPath, outputPath, password, signal);

  if (signal.aborted) throw new Error("cancelled");

  await onProgress("finishing", 100);
  const { size } = await fs.stat(outputPath);
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Password removed (${fmtBytes(size)}). This PDF now opens without a password.`,
  };
};
