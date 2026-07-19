import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
  ServerProcessor,
} from "./types";
import { ProcessingError } from "./types";
import { encrypt, isEncrypted } from "./qpdf";

/*
 * Protect PDF adapter (Section 11.5) — add password protection via qpdf
 * (256-bit AES). The password arrives out-of-band on `input.secret` (never in
 * optionsJson, v1.4.1) and is forwarded to qpdf over stdin by the qpdf helper.
 * A PDF that is already encrypted is rejected (FILE_ENCRYPTED) so we don't
 * silently re-encrypt or need the existing password.
 */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const protectPdf: ServerProcessor = async (
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> => {
  const password = input.secret ?? "";
  if (password.length === 0) {
    throw new ProcessingError("Enter a password to protect this PDF.", {
      code: "INVALID_PASSWORD",
    });
  }
  // The single-line password field and qpdf's line-delimited argfile can't
  // carry a newline; reject rather than silently truncate.
  if (/[\r\n]/.test(password)) {
    throw new ProcessingError("The password can't contain line breaks.", {
      code: "INVALID_PASSWORD",
    });
  }

  await onProgress("checking", 10);

  // Already encrypted? Adding a second layer needs the current password and
  // would confuse users — send them to a clear state instead.
  if (await isEncrypted(input.inputPath, signal)) {
    throw new ProcessingError(
      "This PDF is already password-protected. Unlock it first if you want to change the password.",
      { code: "FILE_ENCRYPTED" },
    );
  }

  const outputName = `zenfyle-protect-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);

  await onProgress("protecting", 40);
  await encrypt(input.inputPath, outputPath, password, signal);

  if (signal.aborted) throw new Error("cancelled");

  await onProgress("finishing", 100);
  const { size } = await fs.stat(outputPath);
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Protected with a password (${fmtBytes(size)}). You'll need this password to open the PDF.`,
  };
};
