# Zenfyle — Project Constitution

**`specs.md` (v1.0.0, frozen) is the single source of truth. Code is a build output. Read it before writing any code — especially Section 11 (architecture blueprint) and Section 9 (phase order).**

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

### Stack (pinned in specs.md §5/§6 — do not substitute)
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind 4 (tokens from §2, not default palette) · Prisma 6 + Postgres (Neon) · BullMQ 5 + Upstash Redis · Auth.js 5 · pdf-lib/pdf.js/browser-image-compression client-side · LibreOffice/Ghostscript/qpdf/Tesseract server-side · Lucide icons only · react-dropzone for all upload zones · npm only (never pnpm/yarn).

### Build commands
`npm install` · `npm run dev` · `npm run lint` · `npm run build`
