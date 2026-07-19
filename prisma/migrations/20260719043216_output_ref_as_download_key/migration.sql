/*
  Warnings:

  - You are about to drop the column `download_token` on the `jobs` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "tool_slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "error_message" TEXT,
    "input_file_ref" TEXT,
    "output_file_ref" TEXT,
    "output_file_size_bytes" INTEGER,
    "output_file_count" INTEGER NOT NULL DEFAULT 1,
    "progress_stage" TEXT,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "expires_at" DATETIME,
    CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_jobs" ("completed_at", "created_at", "error_message", "expires_at", "file_size_bytes", "id", "input_file_ref", "mime_type", "original_filename", "output_file_count", "output_file_ref", "output_file_size_bytes", "progress_percent", "progress_stage", "started_at", "status", "tool_slug", "user_id") SELECT "completed_at", "created_at", "error_message", "expires_at", "file_size_bytes", "id", "input_file_ref", "mime_type", "original_filename", "output_file_count", "output_file_ref", "output_file_size_bytes", "progress_percent", "progress_stage", "started_at", "status", "tool_slug", "user_id" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
CREATE UNIQUE INDEX "jobs_output_file_ref_key" ON "jobs"("output_file_ref");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
