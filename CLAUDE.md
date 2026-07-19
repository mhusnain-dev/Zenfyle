# Zenfyle — Project Constitution

**`specs.md` (v1.4.0, frozen) is the single source of truth. Code is a build output. Read it before writing any code — especially Section 11 (architecture blueprint) and Section 9 (phase order).**

> **Current task state lives in [`PROGRESS.md`](./PROGRESS.md)** — completed work (with how), what's in progress, what's next, and open decisions. Read it right after this file. Keep both files updated as each sub-task completes, not just at context limits.

> Spec version note: `specs.md` §changelog is at **v1.4.0** (v1.0.0 was the frozen baseline; v1.1.0–v1.4.0 are owner-requested visual/icon refinements — palette, per-category accents, real file-format icons). The architecture/phases/registry contract are unchanged from v1.0.0.

## Non-negotiable rules (distilled from specs.md — full text there wins on any conflict)

### Phase Gate Protocol (specs.md §0)
- Work on exactly ONE build phase at a time, in §9 order. When a phase is done, STOP.
- Show the human what was built (run `npm run dev`, give the URL) and wait for explicit confirmation. Silence ≠ approval.
- Never combine two phases in one commit/session unless explicitly told to.
- The human is non-technical: show working results, not walls of code.

### Definition of Done (specs.md §0.1)
A phase/tool is done only if ALL of: `npm run build` clean · `npm run lint` clean · ≥1 real integration test with an actual file · accessibility (§3.6) · responsive at 360/768/1024/1440 · no console errors · no TS errors · reads from tool registry only · no TODO/FIXME left · human accepted.

### Engineering Rules (specs.md §12)
- TypeScript strict, no `any`. RSC by default, `'use client'` only where needed. Functional components only.
- Tailwind utilities only — no inline styles, no per-component CSS files.
- Named exports everywhere except Next.js page/layout/route files.
- Tool registry (`lib/registry.ts`) is the ONLY place tool metadata lives — never hardcode a tool name/icon/badge/slug/limit anywhere else. Registry is immutable at runtime and validated at startup.
- Processing libraries live behind adapters in `lib/processors/` (client) or `server/workers/` (server) — never imported in pages/components.
- Zod-validate all API input; error responses use `{ error: { code, message } }` with §13.7 codes.
- **Anti-hallucination rule:** if a tool can't be built correctly with the spec's named libraries, do NOT approximate — implement server-side with a purpose-built tool or mark it `comingSoon`. When uncertain, fail explicitly.
- **No silent architecture changes:** on any genuine blocker, stop, explain, and propose a spec update (version bump + changelog entry) — never diverge in code while leaving specs.md unchanged. Spec changes ship in the same commit as the code they enable.

### Stack (pinned in specs.md §5/§6 — do not substitute the libraries)
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind 4 (tokens from §2, not default palette) · Prisma 6 · BullMQ 5 · Auth.js 5 (not yet installed — Phase 7) · pdf-lib/pdf.js/browser-image-compression client-side · LibreOffice/Ghostscript/qpdf/Tesseract server-side · Lucide icons (+ react-icons for real file-format glyphs only, §5 v1.4.0 exception) · react-dropzone for all upload zones · npm only (never pnpm/yarn).

**Datastore/queue are behind interfaces so the local target differs from the production target — this is intentional, not drift:**
- **DB:** production = Postgres (Neon); **local dev = SQLite** via `@prisma/adapter-better-sqlite3` (`prisma/schema.prisma` datasource is `provider = "sqlite"`, `dev.db` at repo root). Swapping to Postgres = change the provider + `DATABASE_URL`; the Prisma models are portable (note: SQLite has no JSON/enum type, so `optionsJson` and `status` are `String` — keep them string on Postgres too or migrate deliberately).
- **Queue:** production = BullMQ + Redis (Upstash) with a separate worker process (`worker/index.ts`); **local dev = in-process queue** (`lib/queue/in-process.ts`, runs jobs via `setImmediate` in the Next.js process). Selection is by env: `REDIS_URL` set → `BullMQQueue`, empty → `InProcessQueue` (`lib/queue/index.ts`, `getQueue()` is **async** — always `await getQueue()`).
- **Storage:** `StorageProvider` interface (`lib/storage/`); local = `LocalDiskProvider` writing to `./.storage`, production = R2/S3. Selected by `STORAGE_PROVIDER` env.

### Build commands
`npm install` · `npm run dev` (also starts the in-process queue; a server may already be running on :3000) · `npm run lint` · `npm run build` · `npm run worker` (prod BullMQ worker; only needed when `REDIS_URL` is set).

### Environment constraints (discovered this project — verify, don't assume)
- **No sudo / no Docker / no apt install.** Cannot install system packages the normal way. Workaround used for qpdf: `apt-get download` the .deb (no root) + `dpkg-deb -x` into `~/.local/qpdf`, with a wrapper script at `~/.local/bin/qpdf` that sets `LD_LIBRARY_PATH` to the extracted libqpdf. `~/.local/bin` is on PATH persistently (`.bashrc`), so `qpdf` resolves in new shells and from Node's `spawn`.
- **Installed & confirmed working:** Ghostscript `gs` 10.06.0 (`/usr/bin/gs`), LibreOffice `soffice`/`libreoffice` 26.2.4.2 (`/usr/bin`), qpdf 12.3.2 (user-space, see above).
- **NOT installed:** Tesseract (OCR — needed for Redact PDF, Phase 8+), Redis (fine — local uses the in-process queue). If a future phase needs these, use the same user-space .deb trick or mark the tool `comingSoon`.
- **zod:** now a declared `dependency` (v4.4.3), promoted from transitive in v1.4.1 when the options path started relying on it (`app/api/jobs/route.ts`).

### Server-tool binary invocation rule
Every external binary (gs, soffice, qpdf, …) is invoked with `spawn` from **exactly one place** under `lib/server/tools/`. Usually that's the tool's own adapter file; when two tools share a binary the spawn logic lives in one shared helper they both call (e.g. `qpdf.ts` is the single qpdf spawn point for both `protect-pdf` and `unlock-pdf`). Adding a server tool = one adapter file (+ any shared helper) + one line in `lib/server/tools/index.ts`. Pass an `AbortSignal` to `spawn` for cancellation; throw `ProcessingError(userMessage, { code?, cause? })` (from `lib/server/tools/types.ts`) for input problems — the optional `code` is a §13.7 `ErrorCode` persisted to `Job.error_code` and surfaced to the client (e.g. `INVALID_PASSWORD`), so the pipeline maps failures to a user-facing message/code instead of `UNKNOWN_ERROR`.

**Per-job secrets (v1.4.1):** a password or other secret must never go through `optionsJson` (it's persisted on the `Job` row). POST `/api/jobs` strips `password` out of options and stores it under `storageKeys.secret(jobId)`; the worker reads+deletes it and hands it to the adapter via `ServerProcessInput.secret`. Adapters must pass secrets to a child process over **stdin, never argv** (visible in `ps`/`/proc`).

## Architecture map (where things live)

**Client tool pipeline** (`processing: "client"` tools run entirely in-browser):
- `lib/registry.ts` — the single source of tool metadata (slug/name/category/icon/badge/status/limits/`optionsComponent`/`relatedTools`). Validated at startup by `lib/registry.validate.ts`.
- `lib/processors/*` — one adapter per client tool (pdf-lib etc.) implementing the `Processor` contract in `lib/processors/types.ts`. `lib/processors/server-job.ts` is the browser side of server tools: it POSTs to `/api/jobs`, polls every 2s, downloads the blob, and returns the **same** `ProcessResult` shape — so `ToolPageClient` drives client and server tools through one code path.
- `components/tools/` — shared tool-page template: `ToolPageClient.tsx`, `OptionsPanel.tsx` (resolves `tool.optionsComponent` → a component in `components/tools/options/` via a lookup map, no if/else), `UploadZone`, `ProcessingState`, `ResultState`, `FileList`, `RelatedTools`.

**Server tool pipeline** (`processing: "server"`, `requiresJobQueue: true`):
- `app/api/jobs/route.ts` — `POST`: validate request → gate tool (client-only / comingSoon / unimplemented → `TOOL_UNAVAILABLE`) → content-validate upload (`lib/server/validate-upload.ts`, magic bytes / zero-byte / size, server-side, never trust extension) → create `Job` row → store input → record `usageEvent` (IP is salted-hashed, `IP_HASH_SALT`) → `await getQueue()` then enqueue. **Rate-limit enforcement is NOT here yet — Phase 7.**
- `app/api/jobs/[id]/route.ts` — `GET` status poll (live progress from the job row; signed `download_url` on success; the "already optimal" note rides in `errorMessage` on success and is surfaced as `note`), `DELETE` cancel.
- `app/api/download/[token]/route.ts` — serves the output, re-checking status/expiry against the DB so leaked/stale URLs stop resolving. Token = base64url of the storage key.
- `lib/server/process-job.ts` — the one pipeline every job runs: load input → run adapter (`getServerProcessor(slug)`) → package outputs (>1 output → ZIP via JSZip) → store → mark success + set `expiresAt` (2h) → schedule cleanup. On failure → `error` + user-facing `errorMessage`. Reads/writes progress on the job row so the stateless poll works.
- `lib/server/cleanup.ts` — `cleanupJob` (delete input+output from storage, mark `expired`, idempotent) and `sweepExpiredJobs` (startup/periodic sweep). 2h TTL matches the cleanup delay.
- `worker/index.ts` — the production BullMQ consumer (only runs with `REDIS_URL` set).

**Error handling convention:** every API error is `{ error: { code, message } }` via `apiError(code, msg)` (`lib/server/api-error.ts`) using the fixed §13.7 enum (`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `FILE_CORRUPTED`, `FILE_ENCRYPTED`, `INVALID_PASSWORD`, `TOOL_UNAVAILABLE`, `QUEUE_FULL`, `QUEUE_TIMEOUT`, `WORKER_ERROR`, `RATE_LIMIT_EXCEEDED`, `UNKNOWN_ERROR`). Never leak stack traces/library text — log the real error server-side, return the enum code. Note: the worker→client error path currently carries only a **string** `errorMessage` on the job row, not a code (see PROGRESS.md open decision on `INVALID_PASSWORD`).

**Job schema** (`prisma/schema.prisma`, `Job` model, all snake_case `@map`): `id` (cuid), `userId?` (nullable — anonymous allowed), `toolSlug`, `status` (queued|processing|success|error|cancelled|expired), `originalFilename`, `mimeType`, `fileSizeBytes`, `optionsJson?` (text, JSON-serialized options), `errorMessage?` (also reused for the success "note"), `inputFileRef?`, `outputFileRef?` (@unique — doubles as the download-URL lookup), `outputFileSizeBytes?`, `outputFileCount`, `progressStage?`, `progressPercent`, timestamps (`createdAt`/`startedAt`/`completedAt`/`expiresAt`). `UsageEvent` model backs Phase 7 rate limiting (`ipHash`, `toolSlug`, timestamp).

## Conventions specific to this project
- **`.gitignore`:** `dev.db` resolves to the **repo root** (not `prisma/`); it and `.storage/` are gitignored — don't commit them.
- **Output filenames:** `zenfyle-{slug}-{shortId}[-pNN].{ext}`, `shortId` = last 6 chars of the job id.
- **Options reset per file:** the tool page remounts the OptionsPanel per uploaded file, so each options component owns its defaults and reports up via `onChange` (§13.6).
- **Icons:** resolve through `lib/icons.ts`; registry startup validation fails on any unmapped icon name. Category accents (`CATEGORY_ACCENTS`) are single-source alongside the registry; orange `--signal` is the only CTA color.
