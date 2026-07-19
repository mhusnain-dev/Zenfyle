import { spawn } from "node:child_process";
import { ProcessingError } from "./types";

/*
 * qpdf integration (Section 11.5) — the ONE place qpdf is invoked (adapter
 * pattern, Section 11.1/585). Two tools use it: protect-pdf (encrypt) and
 * unlock-pdf (decrypt/detect); each is a thin ServerProcessor that calls the
 * helpers here, so qpdf's spawn logic lives in a single module.
 *
 * SECURITY (v1.4.1): the password is passed to qpdf over STDIN, never on argv,
 * so it can't be read from the process list (`ps`)/`/proc`:
 *   - decrypt: `--password-file=-` reads the password from stdin.
 *   - encrypt: qpdf has no --password-file for the owner/user password, so we
 *     feed the whole command as an argfile via `@-` (also stdin). Both round-
 *     trip passwords containing spaces (verified against qpdf 12.3.2).
 * A password containing a newline can't be expressed through the single-line
 * password field, and the argfile format is line-delimited, so we reject one
 * defensively in the adapters rather than silently truncating.
 */

type QpdfResult = { code: number | null; stderr: string };

/** Spawn qpdf, optionally writing `stdin` to it. Rejects only on spawn error. */
function runQpdf(
  args: string[],
  signal: AbortSignal,
  stdin?: string,
): Promise<QpdfResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("qpdf", args, { signal });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => resolve({ code, stderr }));
    if (stdin !== undefined) {
      proc.stdin.on("error", () => {}); // ignore EPIPE if qpdf exits early
      proc.stdin.end(stdin);
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * Is the PDF encrypted? qpdf's `--is-encrypted` sets the exit code and writes
 * nothing: rc 0 = encrypted, rc 2 = not encrypted (verified, qpdf 12.3.2).
 */
export async function isEncrypted(
  inputPath: string,
  signal: AbortSignal,
): Promise<boolean> {
  const { code } = await runQpdf(["--is-encrypted", inputPath], signal);
  if (code === 0) return true;
  if (code === 2) return false;
  // Any other code means qpdf couldn't read the file at all.
  throw new ProcessingError(
    "This PDF couldn't be opened — it may be damaged.",
    { code: "FILE_CORRUPTED" },
  );
}

/**
 * Encrypt `inputPath` → `outputPath` with 256-bit AES, using `password` as both
 * the user and owner password (single-password model, Section 11.6). The
 * password is delivered via an `@-` argfile on stdin, never argv.
 */
export async function encrypt(
  inputPath: string,
  outputPath: string,
  password: string,
  signal: AbortSignal,
): Promise<void> {
  // Each line is one argument; qpdf reads the file from stdin via `@-`.
  const argfile = [
    "--encrypt",
    `--user-password=${password}`,
    `--owner-password=${password}`,
    "--bits=256",
    "--",
    inputPath,
    outputPath,
  ].join("\n");

  let result: QpdfResult;
  try {
    result = await runQpdf(["@-"], signal, argfile);
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ProcessingError("Couldn't run the PDF protector on this file.", {
      cause: err,
    });
  }
  if (signal.aborted) throw new Error("cancelled");
  if (result.code !== 0) {
    throw new ProcessingError(
      "This PDF couldn't be protected — it may be damaged.",
      { code: "FILE_CORRUPTED", cause: result.stderr },
    );
  }
}

/**
 * Decrypt `inputPath` → `outputPath` using `password`, read from stdin via
 * `--password-file=-`. A wrong/missing password makes qpdf exit 2 with
 * "invalid password" on stderr and write no output → INVALID_PASSWORD.
 */
export async function decrypt(
  inputPath: string,
  outputPath: string,
  password: string,
  signal: AbortSignal,
): Promise<void> {
  let result: QpdfResult;
  try {
    result = await runQpdf(
      ["--decrypt", "--password-file=-", inputPath, outputPath],
      signal,
      password,
    );
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ProcessingError("Couldn't run the PDF unlocker on this file.", {
      cause: err,
    });
  }
  if (signal.aborted) throw new Error("cancelled");
  if (result.code === 0) return;

  // rc 2 with "invalid password" is the wrong-password case (Section 13.7).
  if (result.code === 2 && /invalid password/i.test(result.stderr)) {
    throw new ProcessingError(
      "That password didn't work. Check it and try again.",
      { code: "INVALID_PASSWORD", cause: result.stderr },
    );
  }
  throw new ProcessingError(
    "This PDF couldn't be unlocked — it may be damaged.",
    { code: "FILE_CORRUPTED", cause: result.stderr },
  );
}
