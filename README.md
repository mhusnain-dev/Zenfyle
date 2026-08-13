# Zenfyle

A responsive, all-in-one PDF and document utility platform with an "ink & paper workshop" aesthetic. Tools run client-side where possible; heavy conversions (PDF↔Office, OCR, compression) run server-side via a job queue.

**Status:** 28 tools implemented (all `active`), Phases 1–8 complete per [specs.md](specs.md) v1.4.4.

---

## ✨ Features

| Category | Tools |
|----------|-------|
| **Merge & Organize** | Merge, Split, Rotate, Organize Pages, Remove Pages, Extract Pages |
| **Convert** | PDF↔Word, PDF↔Excel, PDF↔PPT, PDF→JPG/PNG, JPG→PDF |
| **Compress & Optimize** | Compress PDF, Compress Image, Optimize for Web |
| **Edit & Sign** | Add Page Numbers, Add Watermark, Annotate PDF, Sign PDF, Fill PDF Form |
| **Security** | Protect PDF, Unlock PDF, Redact PDF (permanent), Compare PDF |
| **OCR** | OCR PDF (make scanned PDFs searchable) |

---

## 🛠 Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind 4 (custom tokens from `specs.md` §2) |
| PDF/Image (client) | pdf-lib, pdf.js, browser-image-compression, jsPDF, exceljs |
| PDF/OCR (server) | **Ghostscript**, **LibreOffice headless**, **qpdf**, **Tesseract** |
| Queue | BullMQ 5 + Redis (Upstash) — *dev uses in-process queue* |
| Database | Prisma 6 + Postgres (Neon) — *dev uses SQLite (`./dev.db`)* |
| Auth | Auth.js 5 (Credentials + JWT), bcryptjs |
| Storage | `StorageProvider` interface — LocalDisk (dev) / R2 (prod) |
| Icons | Lucide (primary) + react-icons/fa6 (file-format glyphs) |

---

## 🚀 Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- **Ghostscript** (`gs`) — `apt install ghostscript` or brew
- **LibreOffice** (`soffice`/`libreoffice`) — `apt install libreoffice` or brew
- **qpdf** and **Tesseract** — *installed user-space on this box* (see below)

### User-Space Binaries (No Sudo Required)
This environment cannot install system packages normally. qpdf and Tesseract are extracted to `~/.local/` with wrapper scripts on `PATH`:

```bash
# qpdf 12.3.2
~/.local/bin/qpdf --version

# Tesseract 5.5.0 (+ eng traineddata)
~/.local/bin/tesseract --version
```
**Production must install these as real system packages.**

### Install & Run
```bash
git clone https://github.com/<your-org>/Zenfyle.git
cd Zenfyle
npm install

# Environment (copy .env.example → .env and fill in)
cp .env.example .env
# Required: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
# Optional: REDIS_URL, SMTP_*, MAIL_PROVIDER=smtp, STORAGE_PROVIDER=r2

npx prisma migrate dev   # Creates ./dev.db at repo root
npm run dev              # Starts on :3000 (or :3001 if occupied)
```

Open **http://localhost:3000**

> ⚠️ **After any `prisma migrate` or `prisma generate`, restart `npm run dev`** — a stale Prisma client silently freezes jobs at 100%.

---

## 📁 Project Structure

```
app/
  (marketing)/page.tsx        # Homepage + hero upload
  tools/[slug]/page.tsx       # Shared tool page (all 28 tools)
  (auth)/                     # Login, signup, forgot/reset password
  dashboard/page.tsx          # Account + job history
  api/jobs/                   # POST create, GET poll, DELETE cancel
  api/download/[token]/       # Signed, expiring output URLs
components/
  layout/                     # Header, Footer, PageContainer
  tools/                      # UploadZone, OptionsPanel, ResultState, etc.
lib/
  registry.ts                 # Single source of truth for all tool metadata
  processors/                 # Client-side adapters (pdf-lib, etc.)
  processors/server-job.ts    # Browser side of server tools
  server/
    tools/                    # Server adapters (one per tool, shared spawn points)
    process-job.ts            # Universal worker pipeline
    queue/                    # InProcessQueue (dev) / BullMQQueue (prod)
    storage/                  # LocalDiskProvider / R2Provider
    mail/                     # ConsoleMailProvider / SmtpMailProvider
    rate-limit/               # DbRateLimiter / RedisRateLimiter
  hooks/useToolJob.ts         # Shared upload→process→download state machine
  icons.ts                    # Icon resolution (Lucide + react-icons)
prisma/schema.prisma          # Job, UsageEvent, User, PasswordResetToken
worker/index.ts               # BullMQ consumer (prod only, needs REDIS_URL)
```

---

## 🔧 Key Architecture Decisions

- **Tool Registry = Single Source of Truth** — `lib/registry.ts` holds every tool's slug, category, icon, badge, limits, options component. Validated at startup. *No hardcoded tool metadata anywhere else.*
- **Shared Tool Page Template** — One React component drives all 28 tools; options resolve via a lookup map (`components/tools/OptionsPanel.tsx`).
- **Adapter Pattern** — Processing libraries (pdf-lib, Ghostscript, qpdf, Tesseract, LibreOffice) are **never imported in UI code**. Each lives behind an adapter in `lib/processors/` (client) or `lib/server/tools/` (server).
- **Env-Swap Interfaces** — Queue, Storage, Mail, RateLimiter all behind interfaces so dev ≠ prod without code changes.
- **Password Side-Channel** — PDF passwords never touch `optionsJson`/DB; stripped at upload, stored in ephemeral storage, passed to qpdf via **stdin**.

---

## 📦 Available Scripts

```bash
npm run dev        # Next.js dev server (Turbopack) + in-process queue
npm run build      # Production build (must pass for any phase gate)
npm run lint       # ESLint (must pass for any phase gate)
npm run worker     # BullMQ worker (only with REDIS_URL set)
npx prisma studio  # DB GUI
```

---

## 🌍 Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | `file:./dev.db` (dev) or Postgres (prod) |
| `NEXTAUTH_SECRET` | ✅ | Auth.js session encryption |
| `NEXTAUTH_URL` | ✅ | `http://localhost:3000` (dev) |
| `REDIS_URL` | ❌ | Upstash Redis — enables BullMQ worker |
| `MAIL_PROVIDER` | ❌ | `console` (dev, logs link) or `smtp` (prod) |
| `SMTP_HOST/PORT/USER/PASS` | ❌ | For `MAIL_PROVIDER=smtp` |
| `MAIL_FROM` | ❌ | Sender address (Gmail forces authenticated account) |
| `STORAGE_PROVIDER` | ❌ | `local` (dev, writes `.storage/`) or `r2` (prod) |
| `R2_ACCOUNT_ID/KEY/SECRET/BUCKET` | ❌ | For `STORAGE_PROVIDER=r2` |
| `IP_HASH_SALT` | ✅ | Salt for anonymous IP hashing (rate limits) |
| `AUTH_TRUST_HOST` | ✅ | `true` for local dev behind proxy |

---

## 🧪 Testing a Tool End-to-End

1. Open `http://localhost:3000/tools/compress-pdf`
2. Drop a PDF (>1MB recommended)
3. Choose preset (Low/Medium/High)
4. Click **Compress** → watch progress (queued → processing → success)
5. Download → verify output is smaller (or "already optimal" note shows)

Server tools hit the real API (`/api/jobs` → queue → worker → download). Client tools run entirely in-browser.

---

## 📋 Phase Gate Protocol (from specs.md)

This project is built in **8 strict phases** — each must be **demonstrated working** to a human before proceeding. See `specs.md` §0 and `PROGRESS.md` for history.

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Design tokens + layout shell | ✅ Committed |
| 2 | Header/nav + registry | ✅ Committed |
| 3 | Tool registry + queries | ✅ Committed |
| 4 | Homepage + SEO | ✅ Committed |
| 5 | Client tools (8 tools) | ✅ Committed |
| 6 | Server pipeline + Compress/Protect/Unlock PDF | ✅ Committed |
| 7 | Auth + rate limits + dashboard | ✅ Committed |
| 8 | Remaining 15 tools + OCR category | ✅ Done (uncommitted) |

**All 28 registry tools are now `active`.**

---

## 👤 User Dashboard

The dashboard (`/dashboard`) provides authenticated users with:

- **Account Management** — view email, change password, sign out, delete account
- **Job History** — complete list of past jobs with:
  - Tool name, date, status
  - **Download link** (only if job hasn't expired — 2h TTL)
  - Greyed-out "Expired" label for jobs past their 2-hour window
- **No signup required for tools** — anonymous use is the default; dashboard is optional for history persistence

---

## 🚢 Deployment Notes

| Component | Dev | Production |
|-----------|-----|------------|
| Database | SQLite (`./dev.db`) | Postgres (Neon) — change `provider` in `schema.prisma` |
| Queue | In-process (`setImmediate`) | BullMQ + Upstash Redis (`REDIS_URL`) |
| Storage | Local disk (`.storage/`) | Cloudflare R2 (S3-compatible) |
| Mail | Console (logs reset link) | Transactional (Resend/Postmark/SES) via `SmtpMailProvider` interface |
| Binaries | User-space (`~/.local/`) | **Install as system packages**: `ghostscript`, `libreoffice`, `qpdf`, `tesseract-ocr` + `eng` traineddata |
| Worker | Not needed | `npm run worker` (separate process) |

**Build for production:**
```bash
npm run build
# Then: npm run start (Next.js) + npm run worker (BullMQ consumer)
```

---

## 📝 Specification & Progress Tracking

- **`specs.md`** — Frozen v1.4.4. Single source of truth for product, architecture, engineering rules, and phase order. **Read before contributing.**
- **`PROGRESS.md`** — Living status: what's done, in progress, next, and open decisions.
- **`CLAUDE.md`** — Instructions for AI coding agents (phase gates, rules, gotchas).

---

## 🤝 Contributing

1. Read `specs.md` §0 (Phase Gate Protocol) and §12 (Engineering Rules).
2. Work on **one phase at a time** in §9 order.
3. `npm run build` + `npm run lint` must pass.
4. Every tool needs **at least one real integration test with an actual file**.
5. No `any`, no inline styles, named exports, Tailwind utilities only.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

## Credits

- **Design tokens & product direction** — Project owner
- **Icons** — Lucide, Font Awesome 6 (react-icons)
- **Processing libraries** — pdf-lib, pdf.js, Ghostscript, LibreOffice, qpdf, Tesseract, browser-image-compression, jsPDF, exceljs, diff
- **Infrastructure** — Next.js, Prisma, BullMQ, Auth.js, Tailwind CSS
