import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "./types";

/*
 * SupabaseStorageProvider (Section 6) — server-side Supabase Storage backend.
 *
 * The bucket MUST be created by hand first (Supabase Dashboard → Storage → New
 * bucket) and kept PRIVATE: createSignedUrl() (used by getSignedUrl) only
 * works on private buckets, and objects stay unguessable + expiring the same
 * way LocalDiskProvider's route tokens are. This adapter uses the service-role
 * key, which bypasses RLS — safe here because lib/storage is server-only (it
 * is never imported by client code), so no storage policies are required.
 *
 * Keys map 1:1 to LocalDiskProvider's layout ("jobs/{jobId}/{in|out}/{name}"),
 * so swapping backends is transparent to routes/worker/tools. The one behavior
 * change vs. local disk: getSignedUrl returns a real Supabase signed URL the
 * browser hits directly (it skips the /api/download route's DB re-check, but
 * the signed URL has its own expiry and job expiry is still enforced by the
 * 2h cleanup sweep that deletes the object).
 */
export class SupabaseStorageProvider implements StorageProvider {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(url: string, serviceRoleKey: string, bucket: string) {
    this.client = createClient(url, serviceRoleKey, {
      // Server-side singleton: no localStorage to persist sessions into, and
      // the service-role key is used directly rather than via user auth.
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = bucket;
  }

  async save(fileBuffer: Buffer, key: string): Promise<void> {
    // Blob sidesteps Buffer<->ArrayBuffer typing friction and is well-supported
    // in Node 18+. We store as octet-stream; the download route maps the final
    // extension to a Content-Type when serving (local-disk does the same).
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, new Blob([new Uint8Array(fileBuffer)]), {
        contentType: "application/octet-stream",
        upsert: true,
      });
    if (error) throw error;
  }

  async get(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(key);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([key]);
    if (!error) return;
    // Idempotent like LocalDiskProvider (Section 6 cleanup rule): removing a
    // missing object is a no-op. Supabase surfaces it as a 404/bad-request
    // "The resource was not found" payload.
    const status = (error as { status?: number }).status;
    if (status === 404 || /not found/i.test(error.message)) return;
    throw error;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }
}