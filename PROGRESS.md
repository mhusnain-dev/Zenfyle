# Zenfyle — Progress & Task State

Living status doc. Read `CLAUDE.md` first (rules + architecture), then this. Update both as each sub-task completes, not just at context limits. `specs.md` §9 defines the phase order and is the source of truth.

Last updated: **Phase 8 in progress** — 5 conversion tools shipped and verified end-to-end: Word→PDF, Excel→PDF, PPT→PDF (LibreOffice, shared factory), PDF→JPG, PDF→PNG (Ghostscript, multi-output ZIP). Phase 7 (auth + usage tracking + rate limiting) complete before this.

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

## ⏳ Not started (remaining phases, in §9 order)

**Phase 8 — Remaining conversion tools** (one at a time, same show-before-continue gate). **Shipped so far:** word-to-pdf, excel-to-pdf, ppt-to-pdf (LibreOffice), pdf-to-jpg, pdf-to-png (Ghostscript). **Still to build:** PDF→Word/Excel/PPT (lossy reverse via LibreOffice — will scope tightly per §4.1c), jpg-to-pdf (client, pdf-lib), extract-pages, add-page-numbers, add-watermark, sign-pdf, fill-pdf-form, edit-pdf/annotate (client tools), optimize-for-web (gs/qpdf), compare-pdf (text-diff, no scanned PDFs per §4.1c), and **redact-pdf** (needs Tesseract OCR — NOT installed; user-space install or keep `comingSoon`).

Currently `comingSoon` (13 tools): extract-pages, pdf-to-word, pdf-to-excel, pdf-to-ppt, jpg-to-pdf, optimize-for-web, add-page-numbers, add-watermark, edit-pdf, sign-pdf, fill-pdf-form, redact-pdf, compare-pdf. (Active now: protect-pdf, unlock-pdf, word-to-pdf, excel-to-pdf, ppt-to-pdf, pdf-to-jpg, pdf-to-png.)

---

## 🧹 Known issues / temp hacks to revisit
- **qpdf is a user-space install** (`~/.local/qpdf` + wrapper). Fine for this dev box, but production/deploy must install qpdf as a real system package (documented in CLAUDE.md env section).
- ~~`packageAndStore` ZIP-for->1-output path in `process-job.ts` is currently **unexercised**.~~ **Resolved:** PDF→JPG (multi-page) is the first multi-output server tool; verified end-to-end that a 3-page PDF produces a 3-entry ZIP with spec-compliant `-pNN` names and valid JPEG magic bytes, while a 1-page PDF still takes the single-file direct path.
- `errorMessage` column is **overloaded**: carries both real error text and the success "already optimal" note. Works because they're read in mutually exclusive status branches, but it's a smell — see open decision #2 if adding an error code.
- Nothing from Phase 6 is committed yet — a lot of untracked files (`app/api/`, `lib/db.ts`, `lib/queue/`, `lib/server/`, `lib/storage/`, `lib/processors/server-job.ts`, `prisma/`, `worker/`, `prisma.config.ts`, `.env.example`) plus modified `lib/registry.ts`, `components/tools/ToolPageClient.tsx`, `.gitignore`, `package.json`. Consider a "Phase 6" commit once Protect/Unlock land and the owner signs off.
