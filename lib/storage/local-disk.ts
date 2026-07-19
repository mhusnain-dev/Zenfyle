import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageProvider } from "./types";

/*
 * LocalDiskProvider (Section 6) — the MVP storage backend. Files live under
 * STORAGE_DIR, keyed by "jobs/{jobId}/{in|out}/{name}"; the cuid job id makes
 * keys unguessable. getSignedUrl returns a Route Handler URL that streams the
 * object, carrying the key base64url-encoded as an opaque token. The download
 * route re-checks the job's status/expiry against the DB, so the URL alone is
 * never sufficient once a job is cancelled/expired.
 *
 * Local disk does NOT survive redeploys/restarts — migrate to R2 before public
 * traffic (a provider swap, per the interface). Fine for solo dev + the 2h
 * auto-delete policy.
 */
export class LocalDiskProvider implements StorageProvider {
  private readonly root: string;
  private readonly appUrl: string;

  constructor(root: string, appUrl: string) {
    this.root = path.resolve(root);
    this.appUrl = appUrl.replace(/\/$/, "");
  }

  // Resolve a key to an absolute path, refusing anything that escapes the root
  // (defence against traversal in a key that ever came from untrusted input).
  private resolveKey(key: string): string {
    const full = path.resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new Error(`Refusing storage key outside root: ${key}`);
    }
    return full;
  }

  async save(fileBuffer: Buffer, key: string): Promise<void> {
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, fileBuffer);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    // Idempotent (Section 6 cleanup rule): a missing file is a no-op, not an error.
    try {
      await fs.rm(this.resolveKey(key), { force: true });
      // Best-effort tidy of the now-empty job dir; ignore if not empty/missing.
      await fs.rmdir(path.dirname(this.resolveKey(key))).catch(() => {});
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
  }

  // The `expiresInSeconds` param on the StorageProvider interface is unused
  // here: local-disk expiry is enforced by the download route via the job's
  // expiresAt/status, not encoded in the token itself — simpler and can't be
  // tampered with. (S3/R2 providers will honor it for presigned URLs.)
  async getSignedUrl(key: string): Promise<string> {
    const token = Buffer.from(key, "utf8").toString("base64url");
    return `${this.appUrl}/api/download/${token}`;
  }
}

/** Decode a download token back to its storage key. */
export function decodeStorageToken(token: string): string {
  return Buffer.from(token, "base64url").toString("utf8");
}
