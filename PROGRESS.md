# Zenfyle — Progress & Task State

Living status doc. Read `CLAUDE.md` first (rules + architecture), then this. Update both as each sub-task completes, not just at context limits. `specs.md` §9 defines the phase order and is the source of truth.

Last updated: session handoff during **Phase 6 (server-side tools + API)** — Compress PDF shipped; Protect/Unlock PDF (qpdf) in progress.

---

## ✅ Completed

**Phase 1 — Design tokens + layout shell** — Tailwind 4 tokens from §2 (owner palette v1.2.0, per-category accents v1.3.0), global layout. Committed.

**Phase 2 — Header & navigation + tool registry** — pixel-accurate header/nav; real file-format icons (react-icons, §5 v1.4.0 exception) via `lib/icons.ts`. Committed (`19e18d9`).

**Phase 3 — Registry query surface** — `lib/registry.ts` is the single source of tool metadata; `lib/registry.validate.ts` validates at startup (fails on unmapped icon/bad slug). Search/related/featured queries. Committed (`f9b920c`).

**Phase 4 — Homepage** — tool grid + search + empty state + SEO routes (sitemap.xml, robots.txt). Committed (`b9c05eb`).

**Phase 5 — Client-side tools** — shared tool-page template (`components/tools/ToolPageClient.tsx` + `OptionsPanel` lookup map + UploadZone/ProcessingState/ResultState/FileList/RelatedTools). Adapters in `lib/processors/` (pdf-lib). Tools **active**: Merge, Split, Rotate, Organize, Remove Pages (all client), Compress Image (client). Committed (`d957d96`, `bbdd957`, `e92728d`). Fixed a Strict-Mode revoked-blob-URL download bug in `ResultState`.

**Phase 6 — Server-side pipeline + API (core done, proven with Compress PDF)** — NOT yet committed (all still untracked/modified in git):
- `app/api/jobs/route.ts` — POST create-job (validate → gate → content-validate → create row → store input → record usageEvent → enqueue).
- `app/api/jobs/[id]/route.ts` — GET poll + DELETE cancel.
- `app/api/download/[token]/route.ts` — output serving with DB status/expiry re-check.
- `lib/server/process-job.ts` — the universal worker pipeline (load → adapter → package/ZIP → store → success + 2h expiry → schedule cleanup).
- `lib/server/validate-upload.ts` — magic-bytes / zero-byte / size validation (§6.3).
- `lib/server/api-error.ts` — `{ error: { code, message } }` with §13.7 enum.
- `lib/server/cleanup.ts` — `cleanupJob` + `sweepExpiredJobs`, 2h TTL, idempotent.
- `lib/queue/` — `JobQueue` interface + `InProcessQueue` (dev, `setImmediate`, real AbortController cancellation) + `BullMQQueue` (prod) + async `getQueue()` selector (`REDIS_URL` → which backend).
- `lib/storage/` — `StorageProvider` interface + `LocalDiskProvider` (writes `./.storage`, base64url token signed URLs; expiry enforced at the download route, not in the token).
- `lib/processors/server-job.ts` — browser side of server tools (upload → poll 2s → download), returns the same `ProcessResult` shape as client processors.
- `lib/db.ts` — Prisma client via `@prisma/adapter-better-sqlite3`.
- `prisma/schema.prisma` (SQLite) + `prisma.config.ts` — `Job` + `UsageEvent` + `User` models.
- **Compress PDF adapter** (`lib/server/tools/compress-pdf.ts`) — Ghostscript `gs`, presets low/medium/high → `/prepress`/`/ebook`/`/screen`, never-larger-than-input fallback. Registry flipped to **active**.
- **Verified end-to-end** against the running dev server: 30-page PDF 36KB→17KB, plus zero-byte (400), non-PDF (415), client-only-via-API (404), comingSoon (404), bad token, cancel, expired-download — all handled. `npm run build` + `npm run lint` clean.
- **qpdf installed** user-space (no sudo): `apt-get download` + `dpkg-deb -x` → `~/.local/qpdf`, wrapper `~/.local/bin/qpdf` sets `LD_LIBRARY_PATH`. Verified encrypt/decrypt/wrong-password exit codes (see below). On PATH persistently via `.bashrc`.

---

## 🔨 In progress — Protect PDF + Unlock PDF (finishing Phase 6's server tools, §11.5)

Owner chose "Finish Phase 6 tools" (Protect + Unlock via qpdf) before moving to Phase 7.

**qpdf behavior already verified (12.3.2):**
- Encrypt: `qpdf --encrypt <user> <owner> 256 -- in.pdf out.pdf` (256-bit AES). rc 0 on success.
- Decrypt: `qpdf --decrypt --password=PW in.pdf out.pdf`. Correct PW → rc 0. **Wrong/missing PW → rc 2, stderr `invalid password`, no output written.**
- Detect: `qpdf --is-encrypted in.pdf` → **rc 0 = encrypted, rc 2 = not encrypted** (no output, just exit code).
- ⚠️ `--password-file=` is **NOT supported** in this qpdf's arg style the way first tried (it errored: "encryption options must be terminated with --"). Passing the password as a CLI arg is the working path — but see the open decision below about argv exposure. Re-test `--password-file=-` (stdin) placement carefully if we want to avoid argv; the earlier stdin test failed only because the test file path was wrong, not necessarily the flag.

**What's left in this sub-task (immediate next actions, in order):**
1. **Create the two adapters** `lib/server/tools/protect-pdf.ts` and `lib/server/tools/unlock-pdf.ts` following the `compress-pdf.ts` shape (spawn qpdf with `signal`, `ProcessingError` for bad input). 
   - Protect: read password from `options`, run `--encrypt`. Decide behavior if input is already encrypted (`--is-encrypted` rc 0) — likely `FILE_ENCRYPTED`/friendly message.
   - Unlock: `--is-encrypted` first; if not encrypted → friendly note "this PDF has no password" (return original or explain); if encrypted → `--decrypt --password=`; rc 2 → map to **`INVALID_PASSWORD`**.
2. **Register both** in `lib/server/tools/index.ts` (`SERVER_TOOLS` map) — one line each.
3. **Create the options components** `components/tools/options/ProtectOptions.tsx` and `UnlockOptions.tsx` (single password field, §11.6 — no permission granularity) and add them to the `OPTIONS_COMPONENTS` map in `components/tools/OptionsPanel.tsx`. **Registry already references `optionsComponent: "ProtectOptions"` / `"UnlockOptions"` but the files DON'T EXIST yet** — panel returns null for them today.
4. **Flip registry status** `comingSoon → active` for `protect-pdf` and `unlock-pdf` in `lib/registry.ts` (lines ~540 and ~560).
5. **Handle the password/optionsJson decision** (see below) before persisting real passwords.
6. **Verify** end-to-end: protect a PDF → confirm it's encrypted → unlock it with correct PW → wrong PW returns INVALID_PASSWORD → unlock an unencrypted PDF gives the friendly path. Then `npm run build` + `npm run lint` clean. Update this file, show owner, wait for sign-off (Phase Gate).

---

## ⛔ Open decisions / blockers needing owner or explicit resolution

1. **Password handling for Protect/Unlock (MUST resolve before shipping these).** The password currently would flow through `optionsJson`, which is **persisted on the Job row** and feeds dashboard history — i.e. user PDF passwords at rest in the DB, and visible in `ps`/argv when spawned. §588 anti-hallucination forbids fake/insecure crypto but this is a real handling gap. Options: (a) scrub `optionsJson` immediately after the worker reads it / never persist the password field; (b) pass the password to qpdf via stdin (`--password-file=-`) instead of argv to avoid process-list exposure — re-verify the flag placement; (c) both. **Recommended: never persist the password (strip before `prisma.job.create`, pass it through a side channel to the worker) + stdin to qpdf.** Needs a decision as this deviates slightly from the generic optionsJson flow.
2. **Worker→client error CODE, not just message.** The job row carries `errorMessage` (string) but no error *code*, so the client can't distinguish `INVALID_PASSWORD` from a generic failure to, e.g., re-prompt for the password inline (§4.1c encrypted-PDF flow). Decide whether to add an `errorCode` column to `Job` or encode it in the message. §251 wants an inline wrong-password re-prompt loop — that likely needs the code.
3. **`zod` not a declared dependency** (see CLAUDE.md) — add to package.json `dependencies` explicitly. Low effort, do it opportunistically.

---

## ⏳ Not started (remaining phases, in §9 order)

**Phase 7 — Auth + usage tracking + rate limiting.** Deliverable: sign-up/login working + demonstrate the daily cap actually blocking an anonymous user.
- Auth.js 5 (`next-auth`/`@auth/core`) is **not yet installed**. Email+password only, no social login (§372). Forgot-password email-link flow (§374).
- Routes needed: `/login`, `/signup`, `/forgot-password`, `/dashboard` (§13.4/§13.5 defines dashboard contents: account/email, change-password, sign-out, delete-account that nulls `user_id` on jobs; + job history).
- Rate limiting: **plumbing already exists** — POST `/api/jobs` writes `UsageEvent` (salted `ipHash`, `toolSlug`). Phase 7 just adds the counter check → `RATE_LIMIT_EXCEEDED` (429). No new plumbing.

**Phase 8 — Remaining conversion tools** (one at a time, same show-before-continue gate): PDF↔Word, PDF↔Excel, PDF↔PPT (LibreOffice `soffice` — installed), PDF↔JPG/PNG, Extract Pages, Add Page Numbers, Watermark, Sign, Fill Form, Optimize for Web, Compare PDF, and **Redact PDF** (needs Tesseract OCR — NOT installed; user-space install or keep `comingSoon`).

Currently `comingSoon` (20 tools): extract-pages, pdf-to-word, word-to-pdf, pdf-to-excel, excel-to-pdf, pdf-to-ppt, ppt-to-pdf, pdf-to-jpg, jpg-to-pdf, pdf-to-png, optimize-for-web, add-page-numbers, add-watermark, edit-pdf, sign-pdf, fill-pdf-form, protect-pdf, unlock-pdf, redact-pdf, compare-pdf.

---

## 🧹 Known issues / temp hacks to revisit
- **qpdf is a user-space install** (`~/.local/qpdf` + wrapper). Fine for this dev box, but production/deploy must install qpdf as a real system package (documented in CLAUDE.md env section).
- `packageAndStore` ZIP-for->1-output path in `process-job.ts` is currently **unexercised** (Compress PDF is single-output). First multi-output server tool (e.g. server Split) should verify it.
- `errorMessage` column is **overloaded**: carries both real error text and the success "already optimal" note. Works because they're read in mutually exclusive status branches, but it's a smell — see open decision #2 if adding an error code.
- Nothing from Phase 6 is committed yet — a lot of untracked files (`app/api/`, `lib/db.ts`, `lib/queue/`, `lib/server/`, `lib/storage/`, `lib/processors/server-job.ts`, `prisma/`, `worker/`, `prisma.config.ts`, `.env.example`) plus modified `lib/registry.ts`, `components/tools/ToolPageClient.tsx`, `.gitignore`, `package.json`. Consider a "Phase 6" commit once Protect/Unlock land and the owner signs off.
