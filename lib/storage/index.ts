import type { StorageProvider } from "./types";
import { LocalDiskProvider } from "./local-disk";

/*
 * Single place that picks the storage backend from env (Section 6). Swapping to
 * R2 later means adding an R2Provider branch here and setting STORAGE_PROVIDER
 * — no tool/worker/route code changes.
 */
let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;

  const provider = process.env.STORAGE_PROVIDER ?? "local";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  switch (provider) {
    case "local":
      instance = new LocalDiskProvider(
        process.env.STORAGE_DIR ?? "./.storage",
        appUrl,
      );
      break;
    // case "r2": instance = new R2Provider(...); break;  // added before launch
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
  }
  return instance;
}

export type { StorageProvider };
export { decodeStorageToken } from "./local-disk";

/**
 * Fixed on-disk name for a two-file tool's second input (compare-pdf). The
 * route, worker, and cleanup all reference this constant so the key is
 * reconstructable without a DB column — mirroring the fixed `.secret` name.
 */
export const SECOND_INPUT_FILENAME = "input2.pdf";

/** Storage-key helpers so key layout lives in one place (Section 6 naming). */
export const storageKeys = {
  input: (jobId: string, filename: string) => `jobs/${jobId}/in/${filename}`,
  // Second input file, used only by two-file tools (compare-pdf). Kept in the
  // same per-job `in/` namespace as the primary input and the secret, so the
  // existing cleanup sweep collects it with no extra bookkeeping.
  input2: (jobId: string, filename: string) => `jobs/${jobId}/in2/${filename}`,
  output: (jobId: string, filename: string) => `jobs/${jobId}/out/${filename}`,
  // Short-lived per-job secret (e.g. a PDF password) delivered to the worker
  // out-of-band from optionsJson so it is never persisted in the DB or the
  // dashboard history (v1.4.1). Written by POST /api/jobs, read + deleted by
  // the worker before the adapter runs, and swept by cleanupJob as a backstop.
  secret: (jobId: string) => `jobs/${jobId}/in/.secret`,
};
