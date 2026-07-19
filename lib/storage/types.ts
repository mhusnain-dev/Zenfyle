/*
 * StorageProvider (Section 6). Application/worker code never knows whether a
 * file lives on local disk or in R2/S3 — everything goes through this one
 * interface, so swapping providers is a single-line change (which provider gets
 * instantiated in lib/storage/index.ts), not a rewrite of any tool.
 */
export interface StorageProvider {
  save(fileBuffer: Buffer, key: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /**
   * A time-limited URL to fetch the object. LocalDiskProvider returns a Route
   * Handler URL carrying an unguessable token (the object itself isn't publicly
   * reachable); an R2Provider returns a real S3 signed URL. Named "signed URL"
   * because that's the accurate term across every provider (Section 6).
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
