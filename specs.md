# Zenfyle — Product & Engineering Spec

**Spec Version:** 1.4.1
**Last Updated:** 2026-07-19
**Status:** Frozen — see Section 12's Specification Freeze note. No further architectural changes unless a real implementation blocker is discovered; if one is, update this spec and bump the version before continuing.

(Product name: Zenfyle — checked against web search for existing products/companies and came back clean; not yet verified against a domain registrar or trademark database, e.g. USPTO TESS. Confirm both before any public launch, business registration, or paid marketing spend.)

> **For the coding agent (Claude Code, OpenCode, or any other AI coding assistant) reading this file:** this is a phased build. Read Section 11 (Application Architecture & UI Blueprint) in full before writing any code — it resolves structural decisions (folder layout, routes, homepage content, per-tool options) that the rest of the spec references but doesn't repeat. Then follow Section 9's phase order exactly, and follow the Phase Gate Protocol below without exception. Do not skip ahead to a later phase's code, tools, or files under any circumstance, even if it seems efficient to combine steps.

## Specification Changelog
*(Tracks revisions to this document only — not software releases. Once implementation begins, track actual release history in a root `CHANGELOG.md` instead; the two serve different purposes and won't duplicate each other as long as this one stays scoped to spec-level changes.)*
**v1.4.1 — Password side-channel + error-code column (during Phase 6, implementing Protect/Unlock PDF).** Building the qpdf-backed Protect and Unlock tools surfaced a gap the frozen spec didn't resolve: a PDF password is a per-job secret that must not follow the normal `optionsJson` path (which is persisted on the `Job` row and shown in dashboard history). Two additions, agreed with the owner before coding: **(1) Password side-channel.** The POST `/api/jobs` handler strips `password` out of the parsed options before the job row is written, so it never reaches `optionsJson`/the DB. It's saved instead as a short-lived storage object under a new `storageKeys.secret(jobId)` key; the worker reads it, deletes it immediately, and passes it to the adapter via a new optional `ServerProcessInput.secret` field. `cleanupJob` sweeps the same key as a backstop. The qpdf adapter (`lib/server/tools/qpdf.ts`, the single spawn point shared by both tools) hands the password to qpdf over **stdin** (`--password-file=-` for decrypt, an `@-` argfile for encrypt) — never on argv, so it can't be read from `ps`/`/proc`. **(2) Error-code column.** Added a nullable `error_code` column to the `Job` model (migration `add_error_code`) plus an optional `code: ErrorCode` on `ProcessingError`, so a failed job can persist a machine-readable code. The GET poll route surfaces it as `error_code`, and `server-job.ts` attaches it to the thrown Error. This lets Unlock distinguish a wrong password (`INVALID_PASSWORD`) from a corrupt file (`FILE_CORRUPTED`): `useToolJob` surfaces the code and `ToolPageClient` shows a distinct, non-scary "that password didn't work" banner for `INVALID_PASSWORD` while keeping the file and password field loaded so the user corrects and retries. A fully inline re-prompt (no error screen at all) remains possible later but isn't needed for the correct-and-retry loop to work. `zod` was promoted to a direct dependency (it was already transitively present) since the options path now relies on it. No routing, folder-layout, or phase-order changes.

**v1.4.0 — Real file-format icons (owner-requested, during Phase 2 review).** The owner asked for real MS Word/Excel/PowerPoint/PDF/JPG icons in the menus. Added `react-icons` (Font Awesome file-type glyphs) as a scoped second icon set for format icons, colored per each format's brand color, and updated Section 5's icon rule to permit this one exception. Trademark note recorded: the genuine Microsoft/Adobe logos are unavailable from reputable packs (pulled for trademark reasons) and are deliberately not used; FA's file-type glyphs are the license-safe equivalent. Format icons applied to every tool in every dropdown (owner follow-up): each tool's main icon is the real file-format glyph derived from the formats it accepts/produces (`formatIconForTool`), and the Lucide icon named in the registry is demoted to a small category-colored corner "action badge" so same-format tools (Merge/Split/Sign/Redact — all PDF) stay visually distinct. Convert tools name a format glyph directly and show no action badge. Icon resolution still flows through `lib/icons.ts`, and registry startup validation (Section 12) still fails on any unmapped icon name regardless of which set backs it.
**v1.3.0 — Per-category accent colors (owner-requested, during Phase 2 review).** Icons and category surfaces previously used a single orange accent; the owner asked for colorful, trending icon/section colors. Adds a five-hue category accent system (Section 2's "Category accents" table): each tool category gets a jewel-tone stroke color, a pastel tint container background, and an AA-passing text variant for badges. Defined once as category-level metadata (`CATEGORY_ACCENTS` alongside the registry) and consumed by every surface that renders a tool or category card — the same single-source-of-truth rule as the registry itself (Section 12). Orange `--signal` remains the sole CTA/action color so calls-to-action never compete with category identity.
**v1.2.0 — Owner-supplied palette (during Phase 1 review).** The product owner provided an exact, per-surface color specification (header gradient, CTA states, card borders/shadows, footer link tiers, section background rhythm) which replaces the v1.1.0 palette wholesale. The indigo `--accent` is dropped — orange (`--signal`) is now the single accent across links, hovers, and icons. Fonts unchanged from v1.1.0. Contrast was re-verified: most pairs pass WCAG AA; three pairs fall short and are flagged in Section 2's contrast note (white-on-signal CTA text, signal eyebrow on hero, footer copyright) — applied as supplied, pending owner confirmation or adjustment.
**v1.1.0 — Visual refresh (owner-requested, during Phase 1 review).** The product owner reviewed the Phase 1 build and asked for more beautiful header/footer/body colors and more current/trending fonts. Section 2's palette and typography were revised: display font changed Space Grotesk → Bricolage Grotesque, body font Inter → Plus Jakarta Sans (JetBrains Mono unchanged); `--ink` deepened to a midnight indigo, `--paper` warmed, `--signal` brightened, and `--tool-blue` replaced with a vivid indigo `--accent` (token renamed to reflect that it is no longer blue). All reading-text color pairs re-verified against WCAG AA before adoption (ratios noted in Section 2). No architectural, behavioral, or scope changes — visual tokens only.
**v1.0.0 — Frozen release.** Consolidates four rounds of spec review: UI/header/registry/architecture foundations, engineering rules and product/limits decisions, correctness fixes (Protect/Unlock PDF moved to server-side via qpdf, Redact PDF scoped to permanent removal, encrypted-file handling, expanded jobs table), and final production polish (StorageProvider naming, registry startup validation, Definition of Done, adapter pattern for processing libraries, extended anti-hallucination rule). See Section 12 for the engineering rules this release established and Section 8 for what was deliberately deferred.

## 0. Phase Gate Protocol (mandatory — read before writing any code)
1. Work on exactly one phase at a time, in the order given in Section 9.
2. When a phase is complete, **stop**. Do not start the next phase automatically.
3. Show the human what was built:
   - If the tool supports running/serving the app, start it and give the exact command and local URL to open it.
   - Otherwise, list every file created/changed and give a short summary of what each does.
   - Point out anything from the phase's acceptance checklist (Section 10/11) that is not yet passing or not testable without further input.
4. Ask the human to confirm the phase looks right before continuing. Treat silence or an unrelated message as "not yet confirmed" — do not proceed on assumption.
5. If the human reports something is broken or missing, fix it and re-show the result before moving to the next phase. Do not carry a known-broken phase forward.
6. Never combine two phases into one commit/session unless the human explicitly says to.

This protocol exists because the human is non-technical and needs to see working results at each step, not a wall of finished code at the end.

### 0.1 Definition of Done (agreed addition — a phase or tool may only be called "done" if every item below is true)
- [ ] Builds cleanly (`npm run build`)
- [ ] Lints cleanly (`npm run lint`)
- [ ] Passes at least one real integration test with an actual file (Section 12)
- [ ] Meets the accessibility requirements that apply to it (Section 3.6)
- [ ] Responsive at all four breakpoints (Section 7)
- [ ] No console errors in the browser
- [ ] No TypeScript errors
- [ ] Follows the tool registry as source of truth (Section 4) — no hardcoded tool metadata
- [ ] Follows the Engineering Rules (Section 12)
- [ ] **Manually verified once in a real browser (agreed addition)** — automated checks don't catch everything; hover states, drag-and-drop, and mobile Safari quirks in particular need a real visual pass, not just a passing test suite
- [ ] **No `TODO`/`FIXME` placeholders remain (agreed addition)** — a phase with a `// TODO: handle this later` in it is not finished, it's a known gap; either finish it or explicitly note it as deferred in the phase's summary shown to the human (Section 0 step 3), don't leave it silently in the code
- [ ] Phase accepted by the human (Section 0 step 4)

If any box is unchecked, the phase is not done — don't report it as complete.

## 1. Product Summary
**Zenfyle** is the name of this webapp — a responsive, all-in-one file utility platform (PDF, image, and document tools) similar in function to iLovePDF, but with a distinct visual identity: an "ink & paper workshop" aesthetic rather than a generic SaaS look. Tools run client-side wherever possible to minimize server cost; heavy conversions (PDF↔Word/Excel, OCR) run server-side via a job queue.

**Non-negotiable goals:**
- Fully responsive: mobile (360px+), tablet, desktop, large desktop.
- Header navigation must visually and functionally exceed iLovePDF's — see Section 3 in full detail, build EXACTLY as specified.
- Backend must be modular so new tools can be added without touching unrelated code.
- Database only stores what's necessary — no over-engineering (see Section 6).

---

## 2. Design Tokens

### Color palette *(revised in v1.2.0 — exact owner-supplied palette; applied verbatim)*

**Core tokens:**
| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#102A43` | Header/footer background (top of gradient), dark surfaces |
| `--ink-deep` | `#0C2036` | Bottom of the header/footer gradient |
| `--text` | `#1E293B` | Primary text: headlines, card headings, body on light bg |
| `--text-secondary` | `#64748B` | Secondary/supporting text on light backgrounds |
| `--paper` | `#FCF8F3` | Primary page background |
| `--paper-alt` | `#FBF6EF` | Second alternate ("rhythm") section background |
| `--white` | `#FFFFFF` | Alternate sections, cards, secondary-button background |
| `--signal` | `#FF6B35` | CTA background, nav/link/icon hover, eyebrow labels |
| `--signal-hover` | `#E85A26` | CTA hover background |
| `--border` | `#EAE4D9` | General borders, secondary-button border |
| `--card-border` | `#EFE8DC` | Card resting border |
| `--card-border-hover` | `#FFD9C7` | Card hover border |
| `--icon-bg` | `#FFF0E7` | Card icon container background |
| `--success` | `#157A4A` | Success toasts/states (carried from v1.1.0, owner palette didn't cover) |
| `--error` | `#C13030` | Error toasts/states (carried from v1.1.0, owner palette didn't cover) |

**Per-surface rules (owner-specified, exact):**- **Header:** vertical gradient `#102A43 → #0C2036`. Logo/heading `#F8FAFC`; nav links `#CBD5E1` default, `#FF6B35` hover; Log-in link `#CBD5E1` → `#F8FAFC` hover.
- **Primary CTA:** bg `#FF6B35`, hover `#E85A26`, text `#FFFFFF`; shadow resting `rgba(255,107,53,0.28)`, hover `rgba(255,107,53,0.36)`.
- **Secondary buttons:** bg `#FFFFFF`, border `#EAE4D9`, border hover `#FF6B35`.
- **Body rhythm:** primary bg `#FCF8F3`, alternate sections `#FFFFFF`, second alternate `#FBF6EF`.
- **Hero:** gradient `#FEFBF7 → #FCF4E9`, radial glow behind headline `rgba(255,107,53,0.09)`, eyebrow `#FF6B35`, headline `#1E293B`, supporting copy `#64748B`.
- **Cards:** bg `#FFFFFF`, border `#EFE8DC` → `#FFD9C7` hover; shadow `0 10px 35px rgba(15,23,42,0.07)` → `0 18px 50px rgba(15,23,42,0.12)` hover; icon container `#FFF0E7`, icon stroke `#1E293B` → `#FF6B35` hover; heading `#1E293B`, body `#64748B`.
- **Footer:** bg `#102A43` (gradient-matched to header), headings `#FFFFFF`, links `#A8B0B9` → `#FF6B35` hover, description `#8B9AAB`, copyright `#5E7086`, divider `rgba(255,255,255,0.08)`.

**Category accents (added v1.3.0 — one hue per tool category, used everywhere that category or its tools render):**
| Category | Stroke/icon | Tint container bg | Text variant (badges, AA) |
|---|---|---|---|
| Merge & Organize | `#4F46E5` indigo | `#EEF2FF` | `#4F46E5` (6.29:1 on white) |
| Convert | `#0D9488` teal | `#F0FDFA` | `#0F766E` (5.47:1 on white) |
| Compress & Optimize | `#D97706` amber | `#FFFBEB` | `#B45309` (5.02:1 on white) |
| Edit & Sign | `#7C3AED` violet | `#F5F3FF` | `#7C3AED` (5.70:1 on white) |
| Security | `#E11D48` rose | `#FFF1F2` | `#BE123C` (6.29:1 on white) |

Rules: icon strokes sit on their tint container (all pairs ≥3:1, the WCAG bar for graphical objects); badge/label text uses the text variant (all ≥4.5:1). Defined once next to the tool registry and consumed by every card/menu/grid — never re-declared per component. `--signal` orange stays reserved for CTAs, hovers on nav links, and active states so actions remain visually distinct from category identity; the card icon container `--icon-bg #FFF0E7` is superseded by per-category tints wherever a category is known (generic non-category surfaces may still use it).

> **Contrast note (v1.2.0):** verified — logo on header 13.99:1, nav 9.86:1, nav hover 5.16:1, headline 13.83:1, secondary text 4.50:1 on `--paper` / 4.76:1 on white, footer links 6.68:1, footer description 5.10:1 — all pass WCAG AA. Three owner-supplied pairs fall below AA and are applied as supplied: **white text on the `#FF6B35` CTA (2.84:1)**, **`#FF6B35` eyebrow on the hero (2.75:1)**, and **`#5E7086` copyright on the footer (2.88:1)**. Mitigations if these need to pass later: CTA text could use `#1E293B` (5.16:1) or the CTA bg could darken; the eyebrow is short decorative label text; the copyright line could lighten to `#8B9AAB`. Flagged to the owner at Phase 1 review and **accepted as-is** (owner approved the palette with these noted). Anywhere else in this spec that names `--tool-blue` or `--accent`, read it as `--signal` (orange is the single accent as of v1.2.0); `--ink-secondary` reads as `--text-secondary`, `--paper-dim` as `--border`/`--paper-alt` by context.

### Typography *(revised in v1.1.0 — owner-requested refresh)*
| Role | Font | Weight(s) | Usage |
|---|---|---|---|
| Display / Nav | Bricolage Grotesque | 500, 600, 700 | Header tabs, H1/H2, tool page titles |
| Body | Plus Jakarta Sans | 400, 500, 600 | Paragraphs, descriptions, buttons |
| Mono / Badge | JetBrains Mono | 500 | Format badges e.g. `PDF→DOCX`, file extension tags, code-like labels |

Anywhere else in this spec that still names Space Grotesk or Inter, read Bricolage Grotesque / Plus Jakarta Sans respectively (v1.1.0 change). All three load via `next/font` (Section 5).

Type scale (desktop): H1 40px/48px, H2 28px/36px, H3 20px/28px, Body 16px/24px, Small 13px/18px, Nav label 15px/1 (Space Grotesk 500).

### Spacing & radius
- Base spacing unit: 4px. Use multiples (8, 12, 16, 24, 32, 48, 64).
- Border radius: 10px for cards/buttons, 6px for badges, 2px hairline dividers (not fully square, not overly rounded — avoids both "broadsheet" and "bubbly SaaS" defaults).
- **Max content width: 1200px, centered**, with 24px side padding on mobile (agreed addition — this was undefined and every page/component references "the container").
- **Drag-and-drop library (agreed addition):** use `react-dropzone` for all upload zones — do not hand-roll drag-and-drop event handling per tool, and do not mix a different library on different tool pages.

---

## 3. Header & Navigation Spec (BUILD EXACTLY AS DESCRIBED)

### 3.1 Structure
Sticky header, height 72px desktop / 60px mobile, background `--ink`, full width, subtle 1px bottom border `--paper-dim` at 15% opacity.

Header layout (desktop, left to right):
1. Logo (left, 24px padding-left)
2. Primary nav tabs (horizontally centered-left, starting ~180px from logo)
3. Right cluster: **Search icon** (opens the search overlay, see Section 13.1 — not a language selector), "Log in" (text link, `--white`), "Sign up free" (button, `--signal` bg, `--ink` text, 10px radius)

**Agreed fix from spec review:** the earlier draft included a language selector with no languages ever defined behind it — a dead control an AI agent would otherwise have to invent behavior for. **English only for MVP; no language selector in the header at all.** Re-add it only when real i18n (Section 8, deferred) is actually built — a disabled/placeholder selector is worse than no selector.

### 3.2 Primary Nav Tabs
5 top-level tabs, Space Grotesk 500, 15px, `--white` at 85% opacity (default), `--white` 100% + 2px `--signal` underline on hover/active:

- **Merge & Organize**
- **Convert**
- **Compress & Optimize**
- **Edit & Sign**
- **Security**

Each tab triggers a **mega-menu dropdown on hover** (desktop) — see 3.3. On mobile, tabs become an accordion inside a slide-out drawer (see 3.5).

Hover behavior (desktop):
- On `mouseenter` of a tab: 120ms delay before opening (prevents flicker on fast mouse pass-over), dropdown fades in (opacity 0→1) + slides down 8px→0 over 160ms, ease-out.
- Underline indicator slides horizontally between tabs when hovering across them (single shared underline element, animated via transform, 200ms ease).
- On `mouseleave` of both tab and dropdown panel: 200ms delay before closing (grace period so user can move diagonally into the panel without it closing — implement as an invisible bridge/triangle hit area or a JS delay timer).
- Only one dropdown open at a time.
- Clicking a tab (on touch or if JS hover unsupported) toggles the dropdown instead.

### 3.3 Mega-Menu Dropdown Panel
Background `--paper-dim`, `--ink` text, box-shadow soft (0 12px 32px rgba(0,0,0,0.18)), rounded 12px bottom corners only, full-bleed width capped at container width (max 920px), positioned below full header (not below individual tab) so it reads as one cohesive panel — anchored horizontally to align its left edge with the triggering tab's left edge where possible without overflowing viewport.

Panel internal layout: CSS grid, 3 columns desktop (auto-fit, min 220px), gap 24px, padding 32px.

Each tool entry inside the panel:
```
[icon 32px]  Tool Name                    <- Space Grotesk 500, 15px, --ink
             [MONO BADGE: e.g. "PDF -> DOCX"]  <- JetBrains Mono 500, 11px, --tool-blue, in a --paper pill, 4px radius
             One-line description          <- Inter 400, 13px, --ink-secondary
```
- Entire entry is a single clickable link/card; on hover: background `--paper` (white-ish lift), icon shifts color from `--ink` to `--tool-blue`, 120ms transition, no layout shift (avoid transform scale that causes reflow — use subtle box-shadow lift instead: `0 4px 12px rgba(0,0,0,0.08)`).
- Icons: simple 2px stroke line icons (not filled), consistent stroke width across all tool icons — treat icon set as a single cohesive family, not mixed icon libraries.

Example content mapping for "Merge & Organize" mega-menu:
| Icon | Tool | Badge | Description |
|---|---|---|---|
| stack | Merge PDF | `MULTI -> 1` | Combine multiple PDFs into one file |
| split | Split PDF | `1 -> MULTI` | Extract pages into separate files |
| rotate | Rotate PDF | `PDF (rotate)` | Fix sideways or upside-down pages |
| grid | Organize Pages | `PDF` | Reorder, delete, or duplicate pages |
| trash | Remove Pages | `PDF` | Delete specific pages from a document |

(Apply the same content pattern to Convert, Compress & Optimize, Edit & Sign, Security tabs — full tool list is in Section 4.)

### 3.4 Signature interaction detail
Add one small distinguishing touch: when a mega-menu opens, the format badges (`PDF->DOCX` etc.) very subtly stagger-fade in (each badge delayed 15ms after the previous, opacity 0->1 only, no movement) — reads as a toolbox drawer opening and revealing labeled tools, without being gimmicky. Do not add this effect anywhere else in the UI. Respect `prefers-reduced-motion` — disable stagger and use instant fade if set.

### 3.5 Mobile / Tablet Behavior (< 768px)
- Header collapses to: hamburger icon (left), logo (center), "Sign up" icon-button (right).
- Hamburger opens a full-height slide-in drawer from the left (280px wide on tablet, full-width on phones < 400px), `--ink` background.
- Each of the 5 primary tabs becomes an accordion row (tap to expand/collapse, chevron icon rotates 180deg on expand, 200ms).
- Expanded accordion shows the same tool list vertically (icon + name + badge + description stacked), no grid — single column, full width, 16px vertical padding per row, hairline divider between rows (`--paper-dim` at 10% opacity).
- Drawer closes on: tap outside, tap X, or tap a tool link (navigates immediately).
- No hover states on touch devices — all interaction is tap-based, ensure minimum 44px tap target height per row.

### 3.6 Accessibility requirements
- All dropdown triggers are `<button>` with `aria-expanded` and `aria-controls`.
- Dropdown panels are keyboard-navigable: Tab moves through tool links in order, Escape closes the open dropdown and returns focus to the trigger tab.
- Visible focus ring (2px `--signal`, 2px offset) on all interactive elements — never remove focus outline without replacing it.
- Color contrast: verify all text/background pairs meet WCAG AA (4.5:1 for body/small text, 3:1 for large text ≥18.66px bold or ≥24px regular). At minimum, check `--white` on `--ink`, `--ink` on `--paper-dim`, `--ink-secondary` on `--paper`, and `--tool-blue` on `--paper` — these are the pairs used for actual reading text, not just large surfaces. Do not use opacity-based text colors (e.g. "ink at 60%") without recomputing the blended result against the specific background it sits on — the same opacity value can pass on one background and fail on another.

---

## 4. Tool Registry (single source of truth — build this before the header or homepage)

**Agreed addition from spec review:** tool metadata (name, slug, icon, badge, description, category) was previously duplicated across the header dropdown, homepage grid, and tool pages — a real maintainability risk once tools exceed a handful. Fix: define one registry file/table that every UI surface reads from.

**The tool registry is the single source of truth for every tool. No tool metadata may be duplicated anywhere else in the application** — this includes anything an AI agent might be tempted to inline in a component "just this once" (a tool's name in a button label, its icon in a one-off import, its file limit in a hardcoded check). If it's about a tool, it comes from the registry.

```ts
// tools.registry.ts — shape only, not final code
type Tool = {
  slug: string;            // e.g. "merge-pdf" — used in route /tools/merge-pdf, see 4.1b for the full authoritative list
  name: string;            // "Merge PDF"
  category: 'organize' | 'convert' | 'compress' | 'edit-sign' | 'security';
  badge: string;           // "MULTI -> 1"
  icon: string;            // Lucide icon name — see Section 11.7 for the mapping
  description: string;     // one-line, reused as-is for dropdown copy, homepage card copy, AND meta description — one field, not separate seoTitle/seoDescription fields, to avoid three places to keep in sync for what is functionally the same sentence
  processing: 'client' | 'server';  // determines which build phase it belongs to, see Section 11.5
  requiresJobQueue: boolean;  // agreed addition — cleaner for routing code than repeatedly checking `processing === 'server'`; always true when processing is 'server', always false when 'client' (kept as a separate field rather than derived, so routing code can check one clear boolean instead of a string comparison)
  acceptedTypes: string[]; // e.g. ['.pdf']
  maxFileSizeMb: number;   // see Section 13.2 for concrete values per tool
  searchKeywords: string[]; // agreed addition — extra terms the homepage search (13.1) matches against beyond name/description, e.g. ["combine", "join"] for merge-pdf
  featured: boolean;       // agreed addition — whether this tool appears in a "Popular tools" style placement; false for all tools until real usage data exists to justify featuring any
  homepageOrder: number;   // agreed addition — explicit sort order within its category grid, so ordering isn't left to array insertion order
  status: 'active' | 'comingSoon' | 'beta' | 'disabled';  // agreed addition, replaces an earlier plain boolean — 'active' for anything built in its build phase (Section 9); 'comingSoon' renders the card but disables click-through; 'beta'/'disabled' aren't used yet but exist now so adding them later doesn't require a schema change
  acceptsMultipleFiles: boolean;  // agreed addition — true only for tools like Merge PDF that inherently need 2+ files (Section 13's multi-file rule); false for everything else
  outputExtension: string;  // agreed addition — e.g. ".pdf", ".docx" — used to build the download filename (Section 13.8) without hardcoding it per tool
  optionsComponent: string; // agreed addition — the name of the React component that renders this tool's options panel, e.g. "CompressOptions", "RotateOptions" — see 4.3 for how this is wired
  relatedTools: string[];   // agreed addition — 2-3 tool slugs shown in the tool page's "Related tools" row (Section 11.4); pick tools from the same category
};
```

The header dropdown (Section 3), homepage grid, and individual tool page all render from this single array/table — never hardcode a tool's name/icon/badge in more than one place. Adding a new tool means adding one entry here, not editing three files.

### 4.1 Full Tool List (data to populate the registry — build incrementally, see Section 9 for order)

**Organize:** Merge PDF, Split PDF, Rotate PDF, Organize Pages, Remove Pages, Extract Pages

**Convert:** PDF to Word, Word to PDF, PDF to Excel, Excel to PDF, PDF to PPT, PPT to PDF, PDF to JPG, JPG to PDF, PDF to PNG

**Compress:** Compress PDF, Compress Image, Optimize for Web

**Edit & Sign:** Add Page Numbers, Add Watermark, **Annotate PDF** (display name — slug stays `edit-pdf`, see 4.1c for scope), Sign PDF, Fill PDF Form

**Security:** Protect PDF (add password), Unlock PDF (remove password), Redact PDF, Compare PDF

### 4.1b Tool Slugs (agreed addition — explicit table, do not let an agent auto-generate kebab-case from the name)
`merge-pdf` · `split-pdf` · `rotate-pdf` · `organize-pages` · `remove-pages` · `extract-pages` · `pdf-to-word` · `word-to-pdf` · `pdf-to-excel` · `excel-to-pdf` · `pdf-to-ppt` · `ppt-to-pdf` · `pdf-to-jpg` · `jpg-to-pdf` · `pdf-to-png` · `compress-pdf` · `compress-image` · `optimize-for-web` · `add-page-numbers` · `add-watermark` · `edit-pdf` · `sign-pdf` · `fill-pdf-form` · `protect-pdf` · `unlock-pdf` · `redact-pdf` · `compare-pdf`

### 4.1c Precise Scope for Three Easily-Overpromised Tools (agreed additions — the review is right that these need hard boundaries stated up front, not discovered mid-build)

**Annotate PDF** (slug `edit-pdf`): supports adding highlights, text boxes/callouts, and freehand ink drawing on top of the existing page content. **Does not** support editing or deleting the PDF's original text, or reflowing paragraphs — that is a fundamentally different (and far harder) capability that no client-side library here can safely do. The tool page copy must say "Annotate PDF" and describe it as adding markup, never imply it edits the underlying document text.

**Compare PDF** (server-side): extracts text from both documents and diffs it, showing additions/removals as a text-level diff. **Does not** do a visual/pixel diff, and **does not** support scanned (image-only) PDFs — those have no extractable text layer to diff. If a scanned PDF is submitted, return a clear error (`UNSUPPORTED_FILE_TYPE`, Section 13.7) rather than silently producing an empty or wrong comparison.

**Redact PDF** (server-side): must **permanently remove** the underlying text/content in the redacted area, not draw a black rectangle overlay on top of text that remains extractable underneath. A fake redaction that leaves the original text copyable is a real, well-documented failure mode in redaction tools and a genuine legal/privacy risk, not just a UX nitpick. The UI must state "Permanently removed" so the person understands this isn't reversible, unlike every other tool's "process another file" framing.

**Encrypted PDF handling (agreed addition):** if an uploaded PDF is password-protected, detect this before processing and prompt for the password inline rather than failing generically. Flow: encrypted file detected → password prompt shown → wrong password entered → `INVALID_PASSWORD` (Section 13.7) → correct password lets processing continue. If the specific tool doesn't support encrypted input at all (rare), return `FILE_ENCRYPTED` (Section 13.7) with guidance to run Unlock PDF first.

---

### 4.2 Tool Page UI Flow (applies to every tool in the registry — build once as a shared template, all tools reuse it)

**Agreed addition:** clicking any tool — from the header dropdown, the homepage grid, or a direct link — must open that tool's own dedicated interface at `/tools/[slug]`, not a modal or inline panel. Every tool page follows this exact sequence:

1. **Entry state:** the page opens directly on the upload step — no intermediate "click to start" screen. It must show:
   - A large, prominent **drag-and-drop zone** (dashed border in `--paper-dim`, fills with `--signal`-tinted background on drag-over).
   - Inside the same zone, an explicit **"Browse files" button** that opens the OS-native file picker — drag-and-drop and click-to-browse are both always available together, never one without the other.
   - The zone states the accepted file type(s) and max size for *this specific tool*, pulled from its `acceptedTypes`/`maxFileSizeMb` registry fields (Section 4) — never hardcoded per page.
2. **File selected:** show the filename (`JetBrains Mono`), file size, and a thumbnail/page-count preview where feasible (via `pdf.js` for PDFs). Let the person remove/replace the file before processing starts — don't auto-start processing the instant a file lands unless the tool is a true one-click action. **Agreed addition — preview failure must never block processing:** if `pdf.js` fails to render a thumbnail/page-count (this happens on some valid, non-corrupt PDFs), fall back to showing just the filename and size and let the person proceed to processing normally — a failed preview is a cosmetic miss, not a reason to treat the file as invalid.
3. **Processing:** transitions through the states already defined in Section 6.5 (`uploading → queued → processing`), with a visible progress indicator and honest status text (e.g. "Compressing page 3 of 12" beats a generic spinner where the tool can report real progress).
4. **Result / download state (this is a first-class screen, not an afterthought):**
   - A clear, prominent **primary download button** styled with `--signal`, sized and positioned so it's the obvious next action — not buried under text.
   - Show what changed where relevant (e.g. "2.4 MB → 640 KB" for compression, "12 pages merged into 1 file" for merge).
   - A secondary **"Process another file"** action that returns to the entry state without a full page reload.
   - The 2-hour auto-delete notice (Section 6) stated plainly here, not hidden in a footer.
   - This state should feel like a small reward — a subtle success animation/checkmark is appropriate, but keep it quick and skippable, never blocking the download button behind an animation.
5. **Error state:** if processing fails, replace the processing UI with a clear explanation (using the real `error_message` from Section 6.1's job record, not a generic "something went wrong") and a **"Try again"** action that returns to the entry state with the same file pre-loaded if possible.

This flow is identical in structure for every tool (client-side or server-side, Section 6) — only the processing logic and options panel differ per tool. Do not build a bespoke UI per tool; build this flow once as a shared component/template and parameterize it from the tool registry.

### 4.3 Dynamic Options Panel (agreed addition — the review correctly flagged that options weren't actually wired to anything)
The `OptionsPanel` component (Section 11.1's `components/tools/` folder) takes the current tool's `optionsComponent` field and renders the matching component from a lookup map — it does **not** contain an `if (tool === 'merge') ... else if (tool === 'rotate') ...` chain. Adding a new tool's options means adding one entry to the lookup map and building that one component, not editing a growing conditional in a shared file. Each per-tool options component (e.g. `CompressOptions`) is a small, self-contained component that reads/writes only that tool's option state and matches the choices already specified in Section 11.6.

## 5. Frontend Tech Spec

- Framework: **Next.js 16.x** (App Router), **TypeScript** (strict mode, Section 12), **React 19.x**
- Styling: **Tailwind CSS 4.x**, using the token values from Section 2 mapped into the theme config (do not use default Tailwind palette — override with the tokens above)
- Fonts loaded via `next/font` (Space Grotesk, Inter, JetBrains Mono)
- Client-side PDF/image libraries: `pdf-lib`, `pdf.js`, `browser-image-compression`
- State: minimal — React state/context is sufficient, no need for Redux
- Icons: Lucide (stroke-based) is the primary set for action/UI icons. **Exception (v1.4.0, owner-requested):** file-format icons use Font Awesome's file-type glyphs (`react-icons/fa6` — `FaFileWord`/`FaFileExcel`/`FaFilePowerpoint`/`FaFilePdf`/`FaFileImage`), rendered in each format's brand color, so format-oriented tools show a recognizable document icon. This is a deliberate, scoped mixing of two icon sets — the only permitted one. Note: the *actual* Microsoft/Adobe trademarked logos are intentionally NOT used; they've been removed from reputable icon packs (Simple Icons) for trademark reasons, and Font Awesome's generic file-type glyphs are the license-safe stand-in that reads the same. Both sets are still resolved through `lib/icons.ts` so the registry stays icon-library-agnostic (Section 12).

## 6. Backend, API & Database Spec
**Agreed addition from spec review:** the original spec named categories of tools (a database, an ORM, an auth library) without picking specific ones — different coding agents would make different, possibly incompatible choices. Pinned below.

- **Database:** PostgreSQL, hosted on a free tier (Neon or Supabase — either is fine, pick Neon if undecided, it has the simpler free tier for a single small app).
- **ORM:** **Prisma 6.x** — widest documentation coverage, lowest chance of an AI agent generating subtly-wrong queries.
- **Queue/cache:** Redis via Upstash's free tier (serverless, no self-hosting needed) running **BullMQ 5.x** — do not self-host Redis for this build.
- **Auth library:** **Auth.js 5.x** (NextAuth) — the most widely documented Next.js auth integration, lowest implementation-variance risk across different coding agents. Do not use Clerk/Lucia/Better Auth/custom JWT for this build.
- **Agreed fix — pin majors only, verify patch versions at install time:** the versions above are current majors as of this spec being written; `npm install` will pull the latest compatible minor/patch automatically. If a major version bump has happened since (check `npm view <package> version` at project init), use the new major and note the change — don't silently install an older pinned patch that's since been superseded.
- Backend: Node.js via **Next.js Route Handlers** (the App Router's API mechanism — this is the correct/only term to use; don't also say "API routes" as if it were a separate thing, that's Pages Router terminology and mixing the two is a likely source of an agent generating inconsistent file locations) for lightweight requests; a separate worker process for heavy conversions (LibreOffice headless for Office<->PDF, Ghostscript for compression, Tesseract for OCR, **qpdf for Protect/Unlock PDF — agreed fix, see 11.5**), connected via the BullMQ queue above.
- **Worker pipeline (agreed addition — explicit flow, not just naming BullMQ):**
  ```
  Upload → Validate (type/size, Section 6.3) → Route Handler enqueues job (BullMQ)
    → Worker picks up job → processes file → writes output to storage
    → generates signed URL (expires with the file) → job marked "success"
    → scheduled cleanup deletes the file + invalidates the URL after 2 hours
  ```
  **Worker stall detection (agreed addition):** use BullMQ's built-in stall detection (it already supports this — no custom heartbeat mechanism needed) so a worker that crashes or hangs mid-job doesn't leave the job stuck in `processing` forever; a stalled job gets marked `error` after BullMQ's stall timeout, same as any other worker failure (Section 11.10's 1-retry rule applies here too).
- **StorageProvider interface (agreed addition — architecture improvement, not a bug fix):** the application code should never know or care whether files live on local disk or in Cloudflare R2 — go through one interface:
  ```ts
  interface StorageProvider {
    save(fileBuffer: Buffer, key: string): Promise<void>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;  // agreed rename from getDownloadUrl — "signed URL" is the accurate term across local/R2/S3/GCS providers alike
  }
  ```
  A `LocalDiskProvider` implements this for MVP (its `getSignedUrl` returns a Route Handler URL that streams the file with the job's ID as an unguessable token); an `R2Provider` implements the same interface later using real signed URLs. Swapping providers should mean changing one line (which provider gets instantiated), not touching any tool's processing code.
- **File storage (agreed addition — pin one for MVP):** local disk/tmp storage is acceptable through Phase 6 while building and testing solo — it's free and simplest to debug, via the `LocalDiskProvider` above. Migrate to Cloudflare R2 (S3-compatible, cheap egress) before any public launch or real traffic, since local disk doesn't survive redeploys/restarts — this is a provider swap, not a rewrite, per the interface above. Auto-delete files after 2 hours via a scheduled cleanup job either way.
- **Download URLs (agreed addition):** signed, time-limited URLs only (expire with the file, e.g. 2 hours) — never permanent/public direct links, even though files auto-delete anyway; this avoids a window where a leaked link stays valid.
- **Output file naming (agreed fix — the multi-output case wasn't handled before):**
  - Single-output tools: `zenfyle-{tool-slug}-{short-id}.{ext}`, e.g. `zenfyle-merge-pdf-x7k2.pdf` — the extension comes from the registry's `outputExtension` field (Section 4), not hardcoded per tool.
  - Multi-output tools (e.g. Split PDF producing per-page files): `zenfyle-{tool-slug}-{short-id}-p01.{ext}`, `-p02`, etc.
  - **If a job produces more than 3 output files, package them into a single ZIP** (`zenfyle-{tool-slug}-{short-id}.zip`) instead of offering separate download links for each — simpler UI, one download button either way (Section 4.2 step 4 stays a single primary button regardless of output count).
- **Cleanup policy (agreed fix):** implement cleanup as a BullMQ delayed job scheduled at job-completion time (2-hour delay), not a separate cron sweep. On cleanup: delete the input file(s) and output file(s) from storage, and invalidate the download URL/token — but **do not delete the job's database row**. Instead set its status to a new terminal value, `expired`, so job history (Section 13.5) still shows the job happened even though the file itself is gone. This is required for the dashboard's "greyed-out Expired" behavior already specified in Section 13.5 to actually work. **The cleanup job must be idempotent (agreed addition):** running it twice on the same job (e.g. a BullMQ retry after a transient failure) must not error — deleting an already-deleted file or re-setting an already-`expired` status should be a safe no-op, not a crash.

### 6.1 Database schema
**Agreed addition from spec review:** the original `jobs` table was too minimal to debug failures or show users useful status — no filename, size, or error detail. Expanded below.

- `users` (id, email, password_hash, plan_tier, created_at)
- `jobs`:
  - id, user_id (nullable — anonymous allowed)
  - tool_slug (references the tool registry, not a free-text type)
  - status: `queued | processing | success | error | cancelled | expired` (agreed fix — added `expired`, see Section 6's cleanup policy)
  - original_filename, mime_type, file_size_bytes
  - error_message (nullable — populated on failure so the UI can show *why*, not just "failed")
  - **agreed fix — replaced the single `file_ref` with:** `input_file_ref`, `output_file_ref` (nullable until success; may point to a `.zip` per Section 6's multi-output rule), `output_file_size_bytes` (nullable), `output_file_count` (integer, default 1 — drives the ZIP-if->3 rule)
  - created_at, started_at (nullable), completed_at (nullable), expires_at
- `usage_events` (id, user_id nullable, ip_hash, tool_slug, created_at) — for rate-limiting and basic analytics
- **`waitlist_emails`** (agreed addition — Section 13.3's Pro-tier email capture needs somewhere concrete to live, not "random storage"): id, email, source (enum: `pricing` | `homepage` — agreed fix, widened from a single `pricing_page` value so a future homepage waitlist widget doesn't need a schema migration to add its own source value), created_at, ip_hash

This is still intentionally minimal — no analytics warehouse, no admin schema, no audit-log table yet. Add those only once there's real traffic to justify them (see Section 8, deferred items).

### 6.2 Minimal API contract (needed for Phase 3 — server-side tools can't work without this)
- `POST /api/jobs` — body: `{ tool_slug, file }` (multipart) → returns `{ job_id, status: "queued" }`
- `GET /api/jobs/:id` → returns:
  ```ts
  {
    status: 'queued' | 'processing' | 'success' | 'error' | 'cancelled' | 'expired';
    progress?: {              // agreed fix — replaces a vague `progress?` number
      stage: string;          // e.g. "converting", "compressing"
      percent: number;        // 0-100 integer — always an integer, never a float or string
      currentStep?: number;
      totalSteps?: number;
      currentPage?: number;   // only present for page-based tools that can report it
      totalPages?: number;
      message?: string;       // agreed fix — made optional; not every job has a meaningful human-readable message (e.g. a plain spinner-only tool), UI falls back to the generic step-based label from Section 11.10 when absent
    };
    download_url?: string;    // present only if status is "success"
    error_message?: string;   // present only if status is "error"
  }
  ```
- Frontend polls `GET /api/jobs/:id` every 2s while status is `queued`/`processing` (a websocket is a fine upgrade later, not required for MVP — polling is simpler to build and debug solo).
- Error responses use a consistent shape: `{ error: { code, message } }` — don't return raw stack traces or library error text to the client.

### 6.3 Baseline security requirements (agreed addition — kept intentionally minimal for a pre-traffic MVP)
- Validate file type by actual content/magic bytes, not just file extension, before processing.
- **Reject zero-byte uploads (agreed addition):** an empty file passes basic type/size checks but will fail or behave strangely deep inside a processing library — catch it up front with a clear `FILE_CORRUPTED` error (Section 13.7) rather than letting it reach the worker.
- Enforce `maxFileSizeMb` from the tool registry server-side, not just in the frontend (frontend limits are a UX nicety, not a security control).
- Rate-limit by IP hash on all server-side endpoints (already specified below) — this is your main abuse control at this stage.
- Standard Next.js/framework defaults for CSRF and XSS protection are sufficient at this stage (e.g., same-site cookies, escaping output) — don't build custom auth/crypto.
- Full virus scanning and audit logging are real controls but are deferred (Section 8) until there's traffic that justifies the added complexity — not needed to launch safely given the 2-hour auto-delete policy and file-type validation above. (Signed download URLs are *not* deferred — see Section 6's download URL decision; they're cheap enough to build from day one and closing this gap now avoids retrofitting it later.)
- Rate limiting: anonymous users capped per IP per day on server-side tools (Redis-based counter); client-side-only tools are unlimited since they cost nothing server-side.

### 6.4 Authentication flow (agreed addition — the spec named "auth" without defining the actual flow)
- **Anonymous/guest use is the default** — no account required for any tool, client-side or server-side. This isn't optional; it's core to keeping friction low pre-validation.
- Account signup: email + password only via Auth.js. **No social login (Google/GitHub) for MVP** — it adds OAuth app setup/config overhead for marginal benefit before you have users asking for it; add later if requested.
- **No mandatory email verification for MVP** — verifying email adds a transactional-email service dependency (cost + setup) for a benefit (reduced fake signups) that doesn't matter yet at zero traffic. Revisit once Pro/paid tiers are live and verified email matters for billing disputes.
- Forgot-password: standard email-link reset flow (Auth.js supports this natively) — this one is worth including even at MVP, since a account a person can't recover is a support burden, not just a nice-to-have.
- Session strategy: Auth.js default JWT session strategy — no custom session handling.

### 6.5 Application states (agreed addition — every tool page must implement all of these, not just success/error)
Each tool's UI must handle: `idle → uploading → queued → processing → success | error | cancelled`. See Section 4.2 for exactly how each state should look and behave (entry/upload, processing, download, and error screens). Define copy for each state up front — errors state what happened and how to fix it, no vague "something went wrong."

## 7. Responsive Breakpoints
- Mobile: 360px-767px
- Tablet: 768px-1023px
- Desktop: 1024px-1439px
- Large desktop: 1440px+
Test the header/dropdown behavior explicitly at 360px, 768px, 1024px, and 1440px.

## 8. Deferred Until Post-Validation
A spec review flagged additional gaps: full CI/CD pipeline, i18n/RTL support, admin dashboard, plugin architecture for third-party tools, dark mode, offline/PWA support, command palette, full E2E + visual-regression test suites, structured logging/metrics/observability stack, virus scanning, audit logs, and design-system governance (Storybook, component docs). (Signed download URLs were originally in this list too, but were moved to the baseline build — see Section 6 — since they're cheap to implement from day one.)

These are legitimate production concerns for a funded team with existing users — they are **not** legitimate first steps for a pre-revenue solo build. Adding them now delays shipping Phase 1 by weeks for problems you don't have yet (no traffic to scale for, no team to onboard, no incidents to observe). Revisit this list once the product has real users and revenue; until then, treat it as a backlog, not a blocker.

Minor/optional items from the same review (dark mode, browser support matrix, analytics events, Docker dev environment) fall in the same bucket — nice later, not now.

## 9. Build Phases (each phase ends with a Phase Gate — see Section 0)

**Phase 1 — Design tokens + global layout shell**
Deliverable to show: header, footer, and page container rendering with real tokens (Section 2) applied — no tool logic yet, empty/placeholder page content is fine.

**Phase 2 — Header & navigation (Section 3), pixel-accurate**
Deliverable to show: the full header with working hover dropdowns (desktop) and accordion drawer (mobile), tested at the breakpoints in Section 7. Run through the Section 10 checklist before showing this phase as done.

**Phase 3 — Tool registry (Section 4)**
Deliverable to show: the registry file/data populated with all tools from Section 4.1, plus a simple rendered list (even unstyled) proving the header and homepage can both pull from it without duplication.

**Phase 4 — Homepage**
Deliverable to show: homepage tool grid rendering from the registry, matching the header's badge/icon pattern.

**Phase 5 — Client-side tools**
Build one tool fully (suggest: Merge PDF) end-to-end first — upload, process, download — and show it working before batch-building the rest of the client-side list (Split, Rotate, Organize, Remove Pages, Compress Image). Each tool should hit all states in Section 6.5.

**Phase 6 — Server-side tools + API**
Build the API contract (Section 6.2) and job queue for one tool first (suggest: PDF→Word), show a full upload→queued→processing→download cycle working, before adding Compress PDF, **Protect/Unlock PDF (agreed fix — moved here from client-side, now uses qpdf, see 11.5)**, or any other server-side tool.

**Phase 7 — Auth + usage tracking + rate limiting**
Deliverable to show: sign-up/login working, and a demonstration that rate limits actually trigger for an anonymous user exceeding the daily cap.

**Phase 8 — Remaining conversion tools**
Excel, PPT, and OCR-dependent Redact — add one at a time, same show-before-continuing pattern as Phase 5/6.

Do not start a phase until the previous one has been shown and confirmed per Section 0.

## 10. Acceptance Criteria for Header (Phase 2 gate checklist)
- [ ] Dropdown opens only on hover after ~120ms, closes after ~200ms grace period, no flicker on fast mouse movement across tabs
- [ ] Underline indicator slides smoothly between tabs, doesn't jump
- [ ] Mega-menu is one shared panel anchored to header, not per-tab floating boxes
- [ ] Badge stagger-fade only occurs once per open, respects `prefers-reduced-motion`
- [ ] Mobile drawer accordion works with tap only, 44px+ tap targets, closes on outside tap
- [ ] Keyboard: Tab/Shift+Tab navigates all links, Escape closes dropdown, focus returns to trigger
- [ ] Passes WCAG AA contrast on all header/dropdown text
- [ ] No layout shift (CLS) when dropdown opens/closes

## 11. Application Architecture & UI Blueprint
**Agreed addition from spec review:** the sections above define behavior and visual rules but left structural decisions (folder layout, routes, homepage content, per-tool options) open — different coding agents would fill these gaps differently. Pinned below so the build is deterministic regardless of which agent implements it.

### 11.1 Folder Structure
```
app/
  (marketing)/
    page.tsx                 # homepage
    pricing/page.tsx          # minimal — see Section 13.3, no payment integration yet
    privacy/page.tsx
    terms/page.tsx
  tools/[slug]/page.tsx       # shared tool page template, reads registry
  (auth)/
    login/page.tsx
    signup/page.tsx
    forgot-password/page.tsx
  dashboard/page.tsx          # account + job history, Phase 7+ — contents defined in Section 13.4
  api/
    jobs/route.ts             # POST /api/jobs
    jobs/[id]/route.ts        # GET /api/jobs/:id
  not-found.tsx                # 404
  error.tsx                    # 500
components/
  layout/                     # Header, Footer, PageContainer
  ui/                         # buttons, inputs, badges — shared primitives
  tools/                      # UploadZone, ProcessingState, ResultState, OptionsPanel
lib/
  registry.ts                 # tool registry (Section 4)
  processors/                 # client-side processing functions, one file per tool
hooks/
  useToolJob.ts                # shared upload->process->download state machine
server/
  workers/                    # BullMQ worker processes for server-side tools
  db/                         # Prisma schema + client
  storage/                    # StorageProvider interface + LocalDiskProvider/R2Provider (Section 6)
```

### 11.2 Route Map
`/` · `/tools/[slug]` · `/pricing` · `/login` · `/signup` · `/forgot-password` · `/dashboard` (Phase 7+) · `/privacy` · `/terms` · 404 · 500. No other top-level routes for MVP.

**Agreed fix — no `/contact` route:** the footer's "Contact" link is a plain `mailto:` link, not a contact form/page. A contact form needs a backend endpoint and spam handling that isn't worth building before there's traffic to justify it; a mailto link costs nothing and works immediately.

### 11.3 Homepage — Section Order (agreed addition, this was fully undefined before)
1. **Header** (Section 3)
2. **Hero:** H1 + one-line description + a single prominent upload box (see 11.3.1 for its exact behavior — this is not decorative, it's functional)
3. **Tool categories:** a **search input** ("Search all tools...") sits directly above the category grid — see Section 13.1 for its exact behavior — followed by the 5 categories from Section 4, each as a labeled row/section of tool cards (reuses the same card component as the header dropdown)
4. **"Why Zenfyle"**: 3-4 short value props (privacy/client-side, speed, no signup required) — text + icon, no stock illustrations (see 11.9)
5. **FAQ:** 4-6 questions (what happens to my files, is it free, do I need an account, what's the file size limit) — plain accordion, no animation flourish needed
6. **Footer** (11.8)

No testimonials, no "trusted by" logos section, no pricing table on the homepage — you have neither social proof nor a paid tier live yet; adding placeholder versions of these would look worse than omitting them. Add when real.

**11.3.1 Homepage upload behavior (agreed addition — the review is right that this needs an explicit decision):** dragging or selecting a file on the homepage hero box opens a lightweight **tool picker** showing only tools compatible with that file's type (e.g. a `.pdf` surfaces Merge/Split/Compress/Convert-to-Word, not JPG-to-PDF). This is simpler to build than full auto-detection-and-redirect (no need to guess *which* PDF tool the person wants) and more useful than rejecting the drop outright. If only one compatible tool exists for that file type, skip the picker and go straight to that tool's page.

**File transfer on picker selection (agreed addition — the review correctly flagged this as unresolved):** the file the person already dropped/selected on the homepage carries over automatically to the chosen tool page — held in a shared client-side state/context during the in-app navigation, **not** re-requested. The person should never have to upload the same file twice in this flow. (Edge case: if the navigation somehow triggers a full page reload rather than a client-side route change, falling back to "please re-upload" is acceptable — don't over-engineer around this rare case for MVP.)

### 11.4 Tool Page Anatomy (layout order — pairs with the behavior already specified in Section 4.2)
```
Tool title (H1) + one-line description
        ↓
Upload zone (drag-and-drop + browse button, Section 4.2 step 1)
        ↓
[Once a file is loaded] File preview/filename + Options panel
        ↓                (inline, directly below the file preview —
        ↓                 not a modal/drawer/sidebar; keeps the whole
        ↓                 flow in one vertical scroll, simplest to build
        ↓                 and clearest on mobile)
Primary action button ("Merge", "Compress", etc.)
        ↓
Progress state (Section 4.2 step 3)
        ↓
Result/download state (Section 4.2 step 4)
        ↓
"Related tools" row (2-3 other tools from the same category)
```

### 11.5 Processing Matrix (agreed addition — full per-tool table, not just a client/server rule of thumb)
| Tool | Processing | Notes |
|---|---|---|
| Merge PDF | Client | pdf-lib |
| Split PDF | Client | pdf-lib |
| Rotate PDF | Client | pdf-lib |
| Organize Pages | Client | pdf-lib |
| Remove Pages | Client | pdf-lib |
| Extract Pages | Client | pdf-lib |
| Compress Image | Client | browser-image-compression |
| Optimize for Web | Client | browser-image-compression |
| JPG to PDF | Client | jspdf |
| Add Page Numbers | Client | pdf-lib |
| Add Watermark | Client | pdf-lib |
| PDF to Word | Server | LibreOffice headless |
| Word to PDF | Server | LibreOffice headless |
| PDF to Excel | Server | LibreOffice headless |
| Excel to PDF | Server | LibreOffice headless |
| PDF to PPT | Server | LibreOffice headless |
| PPT to PDF | Server | LibreOffice headless |
| PDF to JPG/PNG | Server | needs a PDF rasterizer; heavier than client-side is worth attempting for multi-page PDFs |
| Compress PDF | Server | Ghostscript — meaningfully better compression than client-side |
| Annotate PDF (`edit-pdf`) | Client | pdf-lib annotation layer — scope limited per 4.1c, no text editing |
| Sign PDF | Client | pdf-lib + canvas signature capture |
| Fill PDF Form | Client | pdf-lib form field API |
| Protect/Unlock PDF | **Server** | **agreed fix (Tier 1) — moved from client to server.** pdf-lib does not have reliable native PDF encryption support (confirmed: implementing real PDF password protection in pdf-lib requires hand-rolling the PDF encryption spec or bolting on a separate crypto library — it's not a built-in capability). Use **qpdf** server-side instead, a mature, purpose-built tool for exactly this. |
| Redact PDF | Server | permanent text/content removal, not an overlay — see scope in 4.1c; needs OCR/text-layer removal, not safely doable client-side |
| Compare PDF | Server | text-diff across two documents (scope limited per 4.1c) — heavier computation |

### 11.6 Tool-Specific Options (agreed addition — each tool has real hidden UX decisions)
| Tool | Options for MVP |
|---|---|
| Merge PDF | Accept 2-5 files, 100MB combined max (agreed fix — reduced from 10 files/50MB each to protect mobile browser memory); show a reorderable list (drag to reorder) before merging; merge only on explicit button click, never automatically. **If a person tries to merge more files or a larger combined size than this client-side limit allows, don't reject the request — automatically route it to the server-side worker instead** (same LibreOffice/pdf-lib-on-server path used for other server tools), so the person never hits a dead end, just a slightly slower path. |
| Split PDF | Choose "split every page into its own file" or "split at specific page numbers" (simple text input like `3,7,10`). Multiple output files — see Section 6's multi-file naming and ZIP rule. |
| Rotate PDF | 90° increments only (90/180/270) via a simple 4-way rotate control — no free-angle rotation for MVP |
| Compress PDF/Image | Three presets: Low / Medium / High compression — no manual quality slider for MVP, presets are simpler to build and explain. **Agreed addition — the tool must never return a larger file than the input:** some compression settings on some source files can accidentally increase size (a known real behavior in several compressors); if the "compressed" output is larger than the original, silently return the original file instead and note in the result screen (Section 4.2 step 4) that the file was already optimally sized. |
| Add Watermark | Text watermark only for MVP (position: center/diagonal, opacity slider); image watermark upload is a later addition |
| Add Page Numbers | Position choice (bottom-center/bottom-right) + starting number; no custom formatting for MVP |
| Sign PDF | Draw-with-mouse/touch signature only for MVP; typed-signature-as-font and upload-signature-image are later additions |
| Protect/Unlock PDF | Single password field, no permission-level granularity (e.g. "allow printing but not editing") for MVP — now server-side via qpdf (see processing matrix above) |

### 11.7 Icon Mapping (Lucide icon names — agreed addition, otherwise each agent guesses differently)
Merge → `layers`, Split → `scissors`, Rotate → `rotate-cw`, Organize/Reorder → `list-ordered`, Remove Pages → `file-minus`, Extract Pages → `file-output`, Compress → `minimize-2`, PDF↔Word → `file-text`, PDF↔Excel → `sheet` (fallback `table`), PDF↔PPT → `presentation`, PDF↔Image → `image`, Add Page Numbers → `hash`, Watermark → `stamp`, Sign → `pen-line`, Fill Form → `edit-3`, Protect → `lock`, Unlock → `unlock`, Redact → `eye-off`, Compare → `git-compare`.

**Agreed fix — verify before building, don't trust this list blindly:** these names are a best-effort mapping, not confirmed against the installed Lucide package version. Before Phase 1, import every icon named above and run `npm run build` — if any name doesn't exist in the installed `lucide-react` version, swap in the closest real icon from Lucide's actual export list rather than guessing a second time. A build that doesn't compile because of a bad icon import is not a "done" phase (Section 12).

### 11.8 Footer & Logo (agreed addition — both were previously just named, not specified)
- **Logo:** a text wordmark reading "Zenfyle" in `Space Grotesk` 600 weight — no icon mark for MVP. A distinct icon mark is a nice-later addition, not needed to launch, and avoids an AI agent generating a generic geometric-shape logo that then needs replacing.
- **Footer:** four columns — *Product* (links to top 5-6 most-used tools), *Company* (Privacy, Terms, Contact — Contact is a `mailto:` link per Section 11.2, not a route), *Resources* (FAQ link), and a fourth column with the Zenfyle wordmark + one-line tagline + copyright (`© 2026 Zenfyle`). No newsletter signup, no social icons for MVP (you have no active social presence yet — empty social icons look worse than none).

### 11.9 Illustrations & Visual Assets
No stock illustrations or generic SaaS hero graphics anywhere in the app. The visual interest comes from the icon set (11.7), the design tokens (Section 2), and real product UI (the upload zone, the file previews) — not decorative art. This keeps the build scope smaller and avoids the generic-AI-generated-illustration look the review correctly flagged as a risk.

### 11.10 Remaining Small Decisions (agreed additions, pinned briefly rather than left open)
- **Progress display:** step-based label (e.g. "Uploading" → "Queued" → "Converting page 3 of 12" → "Preparing download") rather than a bare percentage or spinner, wherever the tool can report real progress; a plain spinner only for the rare tool that genuinely can't.
- **Error display:** inline within the tool page's result area (Section 4.2 step 5) — not a toast/global banner, since the error is specific to this one file/action, not app-wide.
- **Success screen:** inline within the same page/scroll position as the rest of the flow — not a modal or full-page takeover.
- **Empty states needed at MVP:** homepage search with no matches ("No tools found — try a different word"). Dashboard/job-history empty states are Phase 7+ and can be designed then, not now.
- **Upload cancellation:** a visible "Cancel" action during the uploading/processing states that aborts the request and returns to the entry state.
- **Duplicate uploads:** no dedup logic for MVP — re-uploading the same file just creates a new job.
- **Max simultaneous jobs:** 1 active job per anonymous session at a time for MVP (simplicity + cost control); revisit once there's a Pro tier that might justify parallel jobs.
- **Multi-file support:** only where the tool inherently requires it (Merge PDF needs 2+ files); all other tools are single-file for MVP.
- **Worker retry strategy:** 1 automatic retry on transient failure (e.g. worker crash mid-job), then mark the job `error` and surface the real message — don't retry silently forever.
- **Browser support baseline:** last 2 versions of Chrome, Firefox, Safari, Edge. No IE11/legacy support. A full compatibility matrix (per the Deferred section, Section 8) can wait; this baseline is enough to build against now.
- **Basic SEO/metadata:** each tool page needs a unique `<title>`/meta description (pulled from the registry's `description` field) and an Open Graph image using the same design tokens — a `sitemap.xml` and `robots.txt` are cheap to add in Phase 4 alongside the homepage, no reason to defer those two specifically.

## 12. Engineering Rules (agreed addition — the reviewer's suggested "Engineering Rules" section, pinned to remove stylistic variance between coding agents)
- TypeScript strict mode on; no `any` — use `unknown` + narrowing if a type is genuinely not known yet.
- React Server Components by default; add `'use client'` only where interactivity genuinely requires it (upload zone, options panel, progress state).
- Functional components only, no class components.
- Tailwind utility classes only — no inline `style={}` props, no separate CSS files per component.
- No default exports except Next.js page/layout/route files (which require them) — named exports everywhere else, for clearer imports and refactors.
- The tool registry (Section 4) is the single source of truth for tool metadata — never hardcode a tool's name, icon, badge, or slug in a second location. **The registry is immutable at runtime (agreed addition):** no component or API route may modify registry entries programmatically; only editing the registry source file itself (a specification-level change) may change tool metadata. This rules out, for example, a settings UI that "customizes" a tool's name or icon at runtime — that would create a second source of truth by another name.
- No duplicated routes or duplicated components — if two tool pages need the same UI, that's a signal to extract a shared component, not copy-paste.
- Accessibility requirements from Section 3.6 apply to every interactive component built anywhere in the app, not just the header.
- Every phase (Section 9) must pass a clean build (`npm run build`) **and a clean lint pass (`npm run lint`, agreed addition — both are Section 14.1 commands and both are now required, not just the build)** before being shown as complete — a phase that doesn't build or doesn't lint cleanly isn't done.
- Validate all API input with Zod (Section 6.2's endpoints) — reject malformed requests with the error codes in Section 13.7, don't let bad input reach the job queue.
- **Processing library adapter pattern (agreed addition):** never import `pdf-lib`, LibreOffice, Ghostscript, `qpdf`, or any other processing library directly inside a page or UI component. Every processing library sits behind a small adapter function in `lib/processors/` (client-side) or `server/workers/` (server-side, Section 11.1) that the shared tool-page template calls — the same reasoning as the StorageProvider interface above, applied to processing libraries. This means swapping a library later (e.g. a better compression tool) touches one adapter file, not every tool page that happens to use it.
- **Registry startup validation (agreed addition — one of the highest-value additions here):** validate the tool registry at application startup, not just at usage time. Fail the build/startup if: any `slug` is duplicated, any `homepageOrder` collides within the same category, any `icon` name doesn't resolve to a real Lucide export (Section 11.7), or any tool is missing its `optionsComponent` (Section 4.3) when its `status` is `active`. Catching a bad registry entry at startup is far cheaper than discovering it from a broken tool page in production.
- **Completion requires a real integration test, not just a rendered UI (agreed addition):** never consider a tool "implemented" because its upload/options/download UI exists and looks right. Every tool must pass at least one real end-to-end test with an actual file (upload → process → verify the output file is valid) before being marked done in a Phase Gate (Section 0) — a polished UI wrapped around processing that silently fails or produces a corrupt output is not a working tool.
- **Anti-hallucination rule (agreed addition — one of the highest-value additions in this whole spec):** if a tool cannot be implemented correctly, securely, and reliably using the libraries and services named in this spec, **do not approximate or silently degrade functionality.** Either implement it server-side with an appropriate purpose-built tool (as was done for Protect/Unlock PDF moving to qpdf, Section 11.5), or mark the tool `comingSoon` in the registry (Section 4) until real support exists. This rule exists specifically to prevent an agent from inventing fake encryption, a cosmetic-only redaction, or any other feature that looks done but isn't safe or correct. **Agreed extension: when uncertain, fail explicitly instead of guessing** — a clear error surfaced to the person (Section 13.7's error codes) is always better than a silent wrong result.

**Specification freeze (agreed addition):** before starting Phase 1, do one full pass over this document checking for internal consistency — matching terminology (e.g. "Annotate PDF" vs. any leftover "Edit PDF" reference), the processing matrix, the registry, build phases, and status enums all agreeing with each other. Once that pass is done, treat the spec as frozen — avoid changing it mid-build unless a genuine blocker is discovered, and if one is, update the spec itself before continuing, not just the code, so the document stays the source of truth.

**No silent architecture changes during implementation (agreed addition):** once building begins, the coding agent may not change architecture, folder layout, routing, database schema, build phases, registry structure, or engineering rules unless explicitly instructed to. If a genuine blocker is encountered, **stop, explain the issue, and propose a spec update** (bumping the version and adding a Changelog entry) rather than silently diverging in the code while leaving this document unchanged. This is what keeps the frozen spec and the actual implementation from drifting apart over the course of an 8-phase build.

## 13. Product & Limits Decisions (agreed additions — the reviewer correctly identified these as undefined numbers/behaviors an agent would otherwise invent)

### 13.1 Homepage/Search Behavior
A single search input above the tool category grid (Section 11.3, step 3) — not in the header, not in the hero (the hero's upload box is the functional element there, per 11.3.1). Instant filtering against the tool registry's `name`, `description`, and `searchKeywords` fields, plain substring match (case-insensitive) — no fuzzy matching for MVP, it's simpler to build and predictable to test. Debounce input by ~150ms before filtering. Empty state: "No tools found — try a different word" (already specified in 11.10).

### 13.2 File Size Limits (concrete `maxFileSizeMb` values per tool category — fill the registry field from this table)
| Tool category | Limit |
|---|---|
| PDF organize tools (merge/split/rotate/organize/remove/extract pages) | 50 MB per file |
| Merge PDF specifically | 50 MB per file, **2-5 files, 100 MB combined max (agreed fix — reduced from 10 files/50MB each; see 11.6 for the automatic server-side fallback above this limit)** |
| Compress PDF | 100 MB (the tool exists specifically for larger files) |
| Image tools (compress/optimize/JPG↔PDF/PNG) | 20 MB per file |
| Office conversions (PDF↔Word/Excel/PPT) | 30 MB per file (LibreOffice headless gets noticeably slower above this on modest server hardware) |
| Everything else (watermark, page numbers, sign, protect/unlock, redact, compare) | 50 MB per file |

### 13.3 Pricing Page (MVP scope — agreed fix, the review is right an undefined `/pricing` route would get random content)
`/pricing` shows exactly one real plan: **Free** (client-side tools unlimited; server-side tools capped per Section 13.4's anonymous/logged-in numbers). Below it, a single **"Pro — coming soon"** card with an email-capture field (no payment integration, no fake price) — submissions write to the `waitlist_emails` table (Section 6.1), source `pricing`. This doubles as demand validation for a future paid tier. No feature-comparison table with invented Pro features; don't promise specifics you haven't built.

### 13.4 Rate Limits (concrete numbers — agreed addition)
- **Anonymous (no account):** 20 server-side tool operations per day per IP hash; 1 concurrent job at a time (matches 11.10's existing concurrency decision). Client-side-only tools are unlimited (they cost nothing server-side).
- **Logged-in (free account):** 50 server-side operations per day — the incentive to sign up is a higher daily cap, not new features, since there's no Pro tier live yet (13.3).
- These are starting numbers, not researched optimums — revisit once there's real usage data showing they're too tight or too loose.
- **Queue behavior when a second job is started while one is active (agreed addition):** reject the new upload attempt with a clear inline message ("Please wait for your current job to finish") rather than silently queuing it behind the first or replacing it — simplest to build, and avoids a confusing state where two jobs are in flight for one session.
- **Guest → signup job ownership (agreed addition):** if an anonymous person signs up for an account after already running jobs, those prior anonymous jobs (tracked only by IP hash) do **not** retroactively transfer to the new account. This is a real limitation, not an oversight — linking them would need a session-continuity mechanism that isn't worth building before there's demand for it. State this plainly if ever asked, rather than pretending job history is complete.

### 13.5 Dashboard Contents (Phase 7+ — agreed addition, this was previously just a route with no defined content)
Two sections only for MVP:
1. **Account:** email shown, change-password action (via Auth.js), sign-out, **delete account** (agreed addition — removes the user row and disassociates their jobs, doesn't need to cascade-delete job history rows, just null out `user_id` on them).
2. **Job history:** a list of the account's past jobs — tool name, date, status, and a download link *only if* the job's `expires_at` (Section 6.1) hasn't passed yet; expired jobs (status `expired`, Section 6.1) show a greyed-out "Expired" label instead of a broken link.
No storage quota, no profile picture, no team/org features — none of that exists yet at this stage.

### 13.6 Processing Options Persistence (agreed addition)
Every tool's options panel resets to that tool's default preset each time a new file is loaded — options do **not** persist across files within a session or across visits. This is simpler to build and avoids a person unknowingly compressing a second file at "High" because that's what they picked last time on a different file.

### 13.7 Error Codes (agreed addition — concrete enum instead of just naming the `error.code` field)
`FILE_TOO_LARGE` · `UNSUPPORTED_FILE_TYPE` · `FILE_CORRUPTED` (agreed addition — zero-byte files, per 6.3, and malformed/unreadable PDFs, which happen constantly in the real world) · `FILE_ENCRYPTED` (agreed addition — see 4.1c's encrypted-PDF flow) · `INVALID_PASSWORD` (wrong password on protect/unlock, or wrong password entered for an encrypted file) · `TOOL_UNAVAILABLE` (agreed addition — a `comingSoon`/`disabled` tool, Section 4, was somehow hit via direct API call) · `QUEUE_FULL` (agreed addition — the concurrency rule above was hit) · `QUEUE_TIMEOUT` · `WORKER_ERROR` · `RATE_LIMIT_EXCEEDED` · `UNKNOWN_ERROR` (fallback — always log the real underlying error server-side even when the client only sees this generic code).

### 13.8 File Naming Clarification (agreed addition — output naming was already decided, input/display wasn't)
The person's original filename is shown during the upload/preview step (Section 4.2 step 2) so they recognize their own file — but the **downloaded output file always uses the `zenfyle-{tool-slug}-{short-id}.{ext}` convention** already decided in Section 6, not the original filename. Consistent branding and no filename-collision handling needed; the original name was never silently discarded, it's just not what comes back.

### 13.9 Theme (agreed addition — explicit rule so no agent adds dark mode "for free")
**Light mode only for MVP.** No `prefers-color-scheme` media query, no dark token set, no theme toggle anywhere in the UI. Dark mode is already listed in Section 8 (Deferred) — this line exists so an agent doesn't add automatic OS-theme detection without realizing that counts as building it.

## 14. Developer Environment (agreed additions — build/tooling specifics that would otherwise vary silently between agents)

### 14.1 Package Manager & Build Commands
**npm only** — do not introduce a `pnpm-lock.yaml` or `yarn.lock` alongside `package-lock.json`; mixing lockfiles across sessions/agents is a real, avoidable source of broken installs.
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
A phase (Section 9) isn't done until `npm run build` succeeds cleanly (Section 12).

### 14.2 Environment Variables
`DATABASE_URL` (Postgres/Neon connection string) · `REDIS_URL` (Upstash) · `NEXTAUTH_SECRET` · `NEXTAUTH_URL` · `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (only needed once Section 6's storage migrates off local disk). Store these in `.env.local`, never commit them — add `.env.local` to `.gitignore` if it isn't already.

### 14.3 Linting & Formatting (agreed, kept minimal)
Use Next.js's default `eslint-config-next` and default Prettier config — no custom rule set for MVP. Bikeshedding lint rules costs time this build doesn't have to spend.
