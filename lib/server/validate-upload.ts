import type { ErrorCode } from "./api-error";

/*
 * Server-side upload validation (Section 6.3): content-based type checking,
 * zero-byte rejection, and size enforcement — all as a security control, not a
 * UX nicety (the frontend limits don't count). Returns a discriminated result
 * so the Route Handler maps failures straight to a Section 13.7 error code.
 *
 * Magic-byte signatures (not the file extension) decide the real type. This map
 * covers the formats the current tool set actually accepts; add a signature
 * here when a new server tool accepts a new type.
 */
type MagicRule = { mime: string; test: (b: Buffer) => boolean };

const SIGNATURES: Record<string, MagicRule> = {
  ".pdf": {
    mime: "application/pdf",
    // %PDF- ; some files carry a leading BOM/whitespace, so scan the first 1KB.
    test: (b) => b.subarray(0, 1024).includes(Buffer.from("%PDF-")),
  },
  ".png": {
    mime: "image/png",
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
  },
  ".jpg": {
    mime: "image/jpeg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  ".jpeg": {
    mime: "image/jpeg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  ".webp": {
    mime: "image/webp",
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
};

export type ValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; code: ErrorCode; message: string };

export function validateUpload(
  buffer: Buffer,
  acceptedTypes: readonly string[],
  maxFileSizeMb: number,
): ValidationResult {
  // Zero-byte: passes naive checks but breaks deep in the library (Section 6.3).
  if (buffer.byteLength === 0) {
    return {
      ok: false,
      code: "FILE_CORRUPTED",
      message: "This file is empty. Please choose a file with content.",
    };
  }

  const maxBytes = maxFileSizeMb * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `This file is larger than the ${maxFileSizeMb} MB limit for this tool.`,
    };
  }

  // The type must match one of the extensions this tool accepts, by content.
  const matched = acceptedTypes.find((ext) => {
    const rule = SIGNATURES[ext.toLowerCase()];
    return rule?.test(buffer);
  });

  if (!matched) {
    const rule = acceptedTypes
      .map((e) => SIGNATURES[e.toLowerCase()])
      .find(Boolean);
    // If we know the expected type but content didn't match, it's often a
    // renamed or damaged file — FILE_CORRUPTED reads better than "unsupported".
    if (rule && acceptedTypes.every((e) => SIGNATURES[e.toLowerCase()])) {
      return {
        ok: false,
        code: "UNSUPPORTED_FILE_TYPE",
        message: `This doesn't look like a ${acceptedTypes.join(
          " or ",
        )} file. Please upload a supported file type.`,
      };
    }
    return {
      ok: false,
      code: "UNSUPPORTED_FILE_TYPE",
      message: "This file type isn't supported by this tool.",
    };
  }

  return { ok: true, mimeType: SIGNATURES[matched.toLowerCase()].mime };
}
