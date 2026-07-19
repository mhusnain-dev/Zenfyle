# Zenfyle — Progress & Task State

Living status doc. Read `CLAUDE.md` first (rules + architecture), then this. Update both as each sub-task completes, not just at context limits. `specs.md` §9 defines the phase order and is the source of truth.

Last updated: **Phase 8 complete + owner-requested OCR category (spec v1.4.4)** — all **28** registry tools `active`. Latest: new **OCR header tab** (sixth category, after Security) backed by a new **ocr-pdf** tool (scanned PDF → searchable; reuses the redact-pdf flatten+re-OCR pipeline), verified end-to-end over real HTTP. Before that: redact-pdf + pdf-to-excel via the shared Tesseract OCR adapter (v1.4.3); compare-pdf; the "adapter summary → result screen" pipeline fix; the pdfjs "fake worker" bundler fix — see "Known issues". ALL of this is uncommitted. Phase 7 (auth + usage tracking + rate limiting) complete before this.

---

## ✅ Done — "adapter summary → result screen" pipeline fix (verified end-to-end, UNCOMMITTED)

**Why:** for server tools, the result screen (`ResultState.tsx` renders `result.summary`) always showed the hardcoded "Your file is ready to download." The adapter's real outcome text (compress-pdf's ratio, compare-pdf's change counts) was dropped: the worker only ever persisted `note` (via `errorMessage`), and the client's `downloadResult` hardcoded `summary`. Fix adds a real `summary` channel end-to-end. This was a NON-additive change — `note` used to do double duty (advisory AND outcome), so wiring `summary` required splitting the two adapters back.

**All steps DONE (edits applied + migration run, verified against `next dev`; NOT yet committed):**
1. ✅ `prisma/schema.prisma` — added `resultSummary String? @map("result_summary")` to `Job`.
2. ✅ `lib/server/process-job.ts` — success `update` writes `resultSummary: result.summary ?? null` (alongside `errorMessage: result.note ?? null`).
3. ✅ `app/api/jobs/[id]/route.ts` — `summary?: string` in the response type, and the `status === "success"` block populates it (`if (job.resultSummary) body.summary = job.resultSummary;`).
4. ✅ Migration run (`add_result_summary`) + `prisma generate` + `next dev` restarted. (Stale Prisma client silently freezes jobs at 100% — see CLAUDE.md/gotchas — which is exactly what happened until the restart.)
5. ✅ `lib/processors/server-job.ts` — `StatusResponse` has `summary?: string`; `downloadResult` uses `summary: data.summary ?? "Your file is ready to download."` (fallback kept for tools that set no summary).
6. ✅ Note/summary split in both adapters:
   - `lib/server/tools/compare-pdf.ts` — `summary` = change-count line ("Found N removed and M added words…"), `note` = scope caveat ("This is a text-level comparison: it diffs extractable text, not layout, fonts, or images.").
   - `lib/server/tools/compress-pdf.ts` — already correct (ratio line as `summary`, `note` only for "already optimal"); confirmed it now displays.
7. ✅ **Verified:** `npm run lint` + `npm run build` clean. Ran real compress-pdf (summary + "already optimal" note) and compare-pdf jobs end-to-end against `next dev`: different files → "Found 5 removed and 12 added words." + scope note; identical files → "No text differences found…" + scope note.

**Still TO DO (follow-up, not blocking):**
- ❌ Update CLAUDE.md's "GOTCHA — server-job summary is DROPPED" note now that this is resolved, and remove the `errorMessage` overload smell note in "Known issues" below.
- ❌ Commit all of the above (uncommitted).

---

## ✅ Completed

**Phase 1 — Design tokens + layout shell** — Tailwind 4 tokens from §2 (owner palette v1.2.0, per-category accents v1.3.0), global layout. Committed.

**Phase 2 — Header & navigation + tool registry** — pixel-accurate header/nav; real file-format icons (react-icons, §5 v1.4.0 exception) via `lib/icons.ts`. Committed (`19e18d9`).

**Phase 3 — Registry query surface** — `lib/registry.ts` is the single source of tool metadata; `lib/registry.validate.ts` validates at startup (fails on unmapped icon/bad slug). Search/related/featured queries. Committed (`f9b920c`).

**Phase 4 — Homepage** — tool grid + search + empty state + SEO routes (sitemap.xml, robots.txt). Committed (`b9c05eb`).

**Phase 5 — Client-side tools** — shared tool-page template (`components/tools/ToolPageClient.tsx` + `OptionsPanel` lookup map + UploadZone/ProcessingState/ResultState/FileList/RelatedTools). Adapters in `lib/processors/` (pdf-lib). Tools **active**: Merge, Split, Rotate, Organize, Remove Pages (all client), Compress Image (client). Committed (`d957d96`, `bbdd957`, `e92728d`). Fixed a Strict-Mode revoked-blob-URL download bug in `ResultState`.

**Phase 6 — Server-side pipeline + API (Compress + Protect + Unlock PDF)** — Committed (`f193ede`). (Note: an interrupted `npm audit fix --force` un-committed it once via a stray `git reset`; recommitted intact — see the git-safety note below.)
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

## ✅ Done — Protect PDF + Unlock PDF (Phase 6's server tools complete, §11.5) — spec v1.4.1

Owner chose "Finish Phase 6 tools" (Protect + Unlock via qpdf) before moving to Phase 7. Both shipped and verified. Two spec-level additions were needed and agreed before coding (see spec Changelog v1.4.1): the password side-channel and the `error_code` column.

**qpdf behavior verified (12.3.2), now driving the adapters:**
- Encrypt: `@-` argfile on **stdin** carries `--encrypt --user-password=PW --owner-password=PW --bits=256 -- in.pdf out.pdf` (256-bit AES). rc 0 on success. Password never on argv.
- Decrypt: `qpdf --decrypt --password-file=- in.pdf out.pdf` with the password on **stdin**. Correct PW → rc 0. **Wrong/missing PW → rc 2, stderr `invalid password`, no output.** (`--password-file=-` DOES work — the earlier failure was a bad test path, not the flag.)
- Detect: `qpdf --is-encrypted in.pdf` → **rc 0 = encrypted, rc 2 = not encrypted** (exit code only).

**What was built:**
1. **Shared qpdf helper** `lib/server/tools/qpdf.ts` — the single spawn point (adapter pattern), exports `isEncrypted`/`encrypt`/`decrypt`. Passwords go over stdin, never argv. Maps rc→`ProcessingError` codes (`INVALID_PASSWORD`, `FILE_CORRUPTED`).
2. **Two thin adapters** `protect-pdf.ts` (rejects already-encrypted with `FILE_ENCRYPTED`) and `unlock-pdf.ts` (not-encrypted → friendly `note`, returns original; wrong PW → `INVALID_PASSWORD`). Both registered in `SERVER_TOOLS`.
3. **Options components** `ProtectOptions.tsx` (password + confirm + show/hide, mismatch warning) and `UnlockOptions.tsx` (single password + show/hide), both in `OPTIONS_COMPONENTS`.
4. **Registry** flipped `comingSoon → active` for both.
5. **Password side-channel** — POST `/api/jobs` strips `password` out of options before the row is written (never in `optionsJson`), stores it under `storageKeys.secret(jobId)`; worker reads+deletes it and passes it to the adapter via `ServerProcessInput.secret`; `cleanupJob` sweeps the key as a backstop.
6. **`error_code` column** — migration `add_error_code`; `ProcessingError.code`; persisted by `markError` (cleared on success for BullMQ retries); surfaced by GET `/api/jobs/[id]` as `error_code`; `server-job.ts` attaches it to the thrown Error.
7. **`zod`** promoted to a declared dependency (4.4.3).
8. **Inline wrong-password UX (§4.1c)** — `useToolJob` now surfaces `errorCode`; `ToolPageClient` shows a distinct, non-scary banner for `INVALID_PASSWORD` ("That password didn't work", KeyRound icon, signal color) and keeps the file + password field loaded so the user just corrects the password and clicks "Try again". (A fully inline re-prompt without the error screen is still possible later, but the correct-and-retry loop works today.)

**Verified end-to-end against the running dev server** (real HTTP `/api/jobs` pipeline, not just adapters — 10/10 passing): protect→encrypted, unlock w/ correct PW→not-encrypted, wrong PW→job `error` carrying `error_code: INVALID_PASSWORD`, re-protect encrypted→`error_code: FILE_ENCRYPTED`, unlock unencrypted→success + note. Confirmed **no password ever lands in `optionsJson`** (all protect/unlock rows have `options_json: null`, 0 leaked rows) and no `.secret` files linger after processing. `npm run build` (34 routes, TS clean) + `npm run lint` clean.

> Gotcha caught during verification: a dev server started *before* `prisma generate` holds a stale client with no `errorCode` column, so the final success write throws and jobs freeze at "finishing/100" with no logged error. Always restart `next dev` after a migration. Not a code bug — driving `processJob` directly succeeded.

---

## ⛔ Open decisions / blockers needing owner or explicit resolution

*(The four former entries — password/optionsJson handling, worker→client error code, undeclared `zod`, and the inline wrong-password UX — were all resolved in v1.4.1; see the Done section above.)*

None open for Phase 6. Optional future polish (not blocking, not owed): a fully inline password re-prompt that skips the error screen entirely (§251) — today's correct-and-retry loop already lets the user fix a wrong password without re-uploading, so this is cosmetic.

---

## ✅ Done — Phase 7 (Auth + usage tracking + rate limiting) — spec v1.4.2

All shipped, both gates demoed to the owner (auth core + real SMTP email; rate limiting blocking a request). `npm run build` + `npm run lint` clean; homepage stays `Static` and `/tools/[slug]` stays `SSG` (auth state is read client-side via `SessionProvider`/`useSession`, NOT `auth()` in the root layout — doing that forces every page dynamic and kills SEO; see the layout comment).

**Auth core (Auth.js 5, `next-auth@5.0.0-beta.31`):**
- Split config for the Edge/Node boundary: `auth.config.ts` is edge-safe (session strategy, pages, `authorized`/`jwt`/`session` callbacks, NO Node deps) and drives `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`); `auth.ts` spreads it and adds the **Credentials** provider (Prisma + bcryptjs, Node-only). JWT session strategy (§377). `types/next-auth.d.ts` adds `session.user.id`.
- Password hashing: `bcryptjs` (pure-JS, no native build — `bcrypt`/`argon2` need node-gyp which this sandbox lacks) in `lib/server/password.ts`. Login `authorize` compares against a dummy hash on missing user to keep timing ~constant (anti-enumeration).
- `AUTH_SECRET` + `AUTH_TRUST_HOST` in `.env`.

**Routes:** `app/(auth)/{login,signup,forgot-password,reset-password}` + `app/dashboard`. Login uses client `signIn(redirect:false)` for inline errors; signup is a Server Action then auto-signs-in. Dashboard is a server component (defence-in-depth `auth()` recheck + `proxy.ts` gate) showing Account (email, change-password, sign-out, delete-account that nulls `user_id` on jobs per §623) + Job history (download link only if `success` && not expired, else greyed "Expired"). Header is session-aware via `useSession` (shows Dashboard vs Log in/Sign up).

**Rate limiting (`RateLimiter` iface, env `RATE_LIMITER`):** `DbRateLimiter` counts `usage_events` since start-of-UTC-day — anon 20/day by `ipHash`, logged-in 50/day by `userId` (§13.4). Checked in POST `/api/jobs` before accepting the upload → `RATE_LIMIT_EXCEEDED` (429). Concurrency guard: one active job per identity → `QUEUE_FULL` (§618). Added `Job.ipHash` (migration `add_job_ip_hash`) so the anon concurrency check scopes per-IP, not globally. Redis limiter is the prod swap (`RATE_LIMITER=redis`), not built.

**Password reset (`MailProvider` iface, env `MAIL_PROVIDER`):** `PasswordResetToken` table stores a SHA-256 **hash** of the token (never plaintext), 1h expiry, single-use (deleted on consume). `ConsoleMailProvider` (dev) logs the link; **`SmtpMailProvider` (nodemailer) verified sending real email via Gmail SMTP** — owner's Gmail + 16-char App Password in `.env` (gitignored). Gmail forces From = authenticated account. Prod swap = a transactional provider (Resend/Postmark/SES), same interface.

**Migrations added this phase:** `add_password_reset_tokens`, `add_job_ip_hash`.

---

**Compare PDF (`compare-pdf`) — built + verified end-to-end, UNCOMMITTED.** The app's first **two-file** server tool. Text diff only (jsdiff `diffWords`), NOT visual/pixel — rejects scanned/image-only PDFs (`UNSUPPORTED_FILE_TYPE`) via a min-text-chars heuristic. Files:
- `lib/server/tools/pdf-text.ts` — pdfjs text extraction using the **legacy** build (`pdfjs-dist/legacy/build/pdf.mjs`). **pdfjs asset paths (worker + `standard_fonts/`) MUST be built from `process.cwd()/node_modules/pdfjs-dist`, NOT from `require.resolve()`/`import.meta.url`.** Next's bundler rewrites the latter to virtual paths (`[project]/…`) that pdfjs then can't import at runtime, so `getDocument` throws "Setting up fake worker failed" → surfaced as a misleading `FILE_CORRUPTED`. We set `GlobalWorkerOptions.workerSrc` to a concrete `file://` URL for `pdf.worker.mjs` and `standardFontDataUrl` to the real `standard_fonts/` dir (trailing sep required, or every page logs a warning). See the "Known issues" note about standalone output.
- `lib/server/tools/compare-pdf.ts` — the adapter: `diffWords`, renders a red-strike/green-underline report PDF with pdf-lib (Helvetica → sanitize non-Latin1 to "?").
- `components/tools/options/CompareOptions.tsx` — informational panel (original vs compared file, states text-diff scope); registered in `OptionsPanel.tsx` lookup map.
- Two-file plumbing: `file2` form field → route validates it (same magic-byte check) → stored under `storageKeys.input2(jobId, SECOND_INPUT_FILENAME)` (new consts in `lib/storage/index.ts`, fixed key like the secret, no DB column) → worker downloads to `ServerProcessInput.secondInputPath` → `cleanup.ts` sweeps the `in2/` namespace. `ToolPageClient.tsx` caps compare at 2 files (`maxFiles` slice; merge stays unbounded) + tool-neutral "Add a second PDF to compare" copy.
- Added dep `diff@8.0.2` (pinned, ships own types). Registry entry flipped to **active**.
- **Verified:** `npm run lint` + `npm run build` clean; a throwaway tsx script diffed two generated PDFs (correct 1-removed/5-added counts, valid report PDF, scanned/empty PDF correctly rejected). Script deleted after.
- ⚠️ Its `summary`/`note` are a temporary workaround pending the in-progress pipeline fix above (step 7).

---

## ⏳ Not started (remaining phases, in §9 order)

**Phase 8 — Remaining conversion tools** (one at a time, same show-before-continue gate). **COMPLETE** — the last two `comingSoon` tools are now built + verified (uncommitted):
- `pdf-to-excel` — now **active**. Geometry-based table reconstruction (pdfjs positioned words via `extractPositionedText`) + Tesseract OCR fallback for scanned pages, written to xlsx with `exceljs` (new pinned dep `exceljs@4.4.0`). Best-effort with an honest "check the columns/rows" note; `UNSUPPORTED_FILE_TYPE` when nothing extractable. NOT LibreOffice — it has no PDF→Calc filter (spec matrix corrected in specs.md v1.4.3). Adapter: `lib/server/tools/pdf-to-excel.ts`. Verified: digital-table PDF → clean columns; scanned PDF → OCR-recovered rows.
- `redact-pdf` — now **active**. Permanent removal per §4.1c: flatten page (Ghostscript raster → burn regions black with sharp) then rebuild an invisible searchable text layer via Tesseract OCR (pdf-lib `setTextRenderingMode(Invisible)`). UI: `RedactOptions.tsx` (pdf.js box drawing, normalized coords) wired into OptionsPanel. Adapter: `lib/server/tools/redact-pdf.ts`. Verified end-to-end: a redacted SSN line is absent from the output's extractable text layer while the rest stays searchable.
- New shared OCR adapter `lib/server/tools/ocr.ts` — single `tesseract` spawn point (renders a page via gs, parses TSV word boxes). Tesseract 5.5.0 now installed user-space (see CLAUDE.md env + Known issues).

Everything else in Phase 8 is **active**: word-to-pdf, excel-to-pdf, ppt-to-pdf, pdf-to-jpg, pdf-to-png, pdf-to-word, pdf-to-ppt, jpg-to-pdf, extract-pages, add-page-numbers, add-watermark, optimize-for-web, sign-pdf, fill-pdf-form, annotate-pdf, compare-pdf.

**Post-Phase-8, owner-requested (spec v1.4.4, uncommitted): OCR category + ocr-pdf tool.** A sixth header tab "OCR" (after Security) backed by `ocr-pdf` — makes a scanned/image-only PDF searchable. Adapter `lib/server/tools/ocr-pdf.ts`: per page, Ghostscript raster (300 DPI via `ocr.ts`) → Tesseract → pdf-lib rebuild as flattened image + invisible text layer (`setTextRenderingMode(Invisible)` — redact-pdf's pipeline minus the blackout). Zero words recognized document-wide → `UNSUPPORTED_FILE_TYPE` (§592). Registry: `ocr` in `ToolCategory`/`CATEGORY_LABELS`/`CATEGORY_ORDER`, sky-blue accent tokens (`--color-cat-ocr*` in globals.css + `lib/accents.ts`), Lucide `scan-text` in `lib/icons.ts`, `NoOptions` panel. **Verified end-to-end over real HTTP:** image-only fixture (0 extractable chars) → job success → downloaded output extracts the full fixture text ("Zenfyle OCR Fixture / The quick brown fox jumps / over the lazy dog 12345"); header shows the OCR tab after Security (desktop + mobile drawer); `npm run lint` + `npm run build` clean (40 static pages, was 39). All **28** registry tools now `active`.

---

## 🧹 Known issues / temp hacks to revisit
- **qpdf is a user-space install** (`~/.local/qpdf` + wrapper). Fine for this dev box, but production/deploy must install qpdf as a real system package (documented in CLAUDE.md env section).
- **Tesseract is a user-space install** (`~/.local/tesseract` + `~/.local/bin/tesseract` wrapper setting `LD_LIBRARY_PATH` + `TESSDATA_PREFIX`). Same story as qpdf — production must install `tesseract-ocr` + `eng` traineddata as a real system package. Used by Redact PDF and PDF→Excel via `lib/server/tools/ocr.ts`.
- **PDF→Excel table extraction is best-effort** — it reconstructs a grid from word geometry (a PDF has no table model), so irregular layouts can mis-column. The tool says so in its result note. If accuracy matters more later, consider a purpose-built table extractor (e.g. Camelot/Tabula-style ruling-line detection).
- ~~`packageAndStore` ZIP-for->1-output path in `process-job.ts` is currently **unexercised**.~~ **Resolved:** PDF→JPG (multi-page) is the first multi-output server tool; verified end-to-end that a 3-page PDF produces a 3-entry ZIP with spec-compliant `-pNN` names and valid JPEG magic bytes, while a 1-page PDF still takes the single-file direct path.
- `errorMessage` column is still **overloaded**: with the summary channel now live it mostly carries the `note` (advisory) plus real error text, but the two are read in mutually exclusive status branches so it works — still a smell. See open decision #2 if adding an error code.
- **pdfjs worker path assumes `pdfjs-dist` stays unbundled in `node_modules` at runtime.** The compare-pdf extractor (`lib/server/tools/pdf-text.ts`) resolves its worker/font assets via `process.cwd()/node_modules/pdfjs-dist`, which holds for `next dev` and `next start` on this box. **If we ever move to Next standalone/output-tracing or a container that prunes `node_modules`, verify `pdf.worker.mjs` + `standard_fonts/` get traced/copied**, or the extractor will throw "Setting up fake worker failed" again (surfaced as `FILE_CORRUPTED`). Consider adding these to `outputFileTracingIncludes` for the jobs API route at that point. Only verified in dev (Turbopack) so far, not in a production build's runtime.
- Nothing from Phase 6 is committed yet — a lot of untracked files (`app/api/`, `lib/db.ts`, `lib/queue/`, `lib/server/`, `lib/storage/`, `lib/processors/server-job.ts`, `prisma/`, `worker/`, `prisma.config.ts`, `.env.example`) plus modified `lib/registry.ts`, `components/tools/ToolPageClient.tsx`, `.gitignore`, `package.json`. Consider a "Phase 6" commit once Protect/Unlock land and the owner signs off.
