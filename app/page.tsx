import Link from "next/link";
import {
  ArrowLeftRight,
  Layers,
  Lock,
  Minimize2,
  PenLine,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";

/*
 * Phase 1 placeholder homepage (Section 9: placeholder content is fine).
 * The functional homepage — hero upload box (11.3.1), search (13.1), and the
 * per-tool grid — arrives in Phase 4 and reads from the tool registry.
 *
 * v1.2.0 palette, exact per-surface rules from Section 2:
 * hero gradient #FEFBF7 → #FCF4E9 with a radial signal glow, body rhythm
 * paper → white → paper-alt, cards with #EFE8DC → #FFD9C7 borders and the
 * owner-specified shadow pair.
 *
 * Category names/descriptions here mirror the five nav categories (Section
 * 3.2); no per-tool metadata is hardcoded (Section 12's registry rule).
 */

const CATEGORIES = [
  {
    name: "Merge & Organize",
    description: "Combine, split, and rearrange PDF pages",
    badge: "6 TOOLS",
    icon: Layers,
  },
  {
    name: "Convert",
    description: "PDF to Word, Excel, PPT, images — and back",
    badge: "9 TOOLS",
    icon: ArrowLeftRight,
  },
  {
    name: "Compress & Optimize",
    description: "Shrink PDFs and images without the ugly artifacts",
    badge: "3 TOOLS",
    icon: Minimize2,
  },
  {
    name: "Edit & Sign",
    description: "Annotate, watermark, number pages, and sign",
    badge: "5 TOOLS",
    icon: PenLine,
  },
  {
    name: "Security",
    description: "Protect, unlock, redact, and compare documents",
    badge: "4 TOOLS",
    icon: Lock,
  },
];

const VALUE_PROPS = [
  {
    title: "Private by design",
    description:
      "Most tools run entirely in your browser — your files never leave your device. Server-processed files are deleted within 2 hours.",
    icon: ShieldCheck,
  },
  {
    title: "Fast, no fuss",
    description:
      "Drop a file, get a result. No watermarks on your output, no artificial waiting screens, no upsell walls between you and your download.",
    icon: Zap,
  },
  {
    title: "No account needed",
    description:
      "Every tool works without signing up. Create an account only if you want higher daily limits and job history.",
    icon: UserRound,
  },
];

const CARD_CLASSES =
  "group rounded-card border border-card-border bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.07)] transition-all hover:border-card-border-hover hover:shadow-[0_18px_50px_rgba(15,23,42,0.12)]";

export default function Home() {
  return (
    <>
      {/* Hero — gradient #FEFBF7 → #FCF4E9 with radial signal glow */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-[#FEFBF7] to-[#FCF4E9]">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,107,53,0.09),transparent_65%)]"
        />
        <PageContainer>
          <div className="relative flex flex-col items-center py-20 text-center md:py-28">
            <span className="rounded-badge bg-icon-bg px-3 py-1.5 font-mono text-[11px] font-medium tracking-wider text-signal">
              INK &amp; PAPER WORKSHOP
            </span>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight text-text md:text-[40px] md:leading-[48px]">
              Every file tool, one honest workshop
            </h1>
            <p className="mt-5 max-w-xl font-body text-base leading-6 text-text-secondary">
              Merge, convert, compress, sign, and protect PDFs and images —
              free, fast, and without your files leaving the browser for most
              tools.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="#categories"
                className="rounded-card bg-signal px-6 py-3 font-body text-base font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_20px_rgba(255,107,53,0.36)]"
              >
                Explore the tools
              </Link>
              <Link
                href="#why"
                className="rounded-card border border-border bg-white px-6 py-3 font-body text-base font-medium text-text transition-colors hover:border-signal"
              >
                Why Zenfyle?
              </Link>
            </div>

            {/* Stylized preview of the upload zone (functional version: Phase 4) */}
            <div className="mt-14 w-full max-w-2xl rounded-card border-2 border-dashed border-border bg-white p-10 text-center shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
              <p className="font-display text-lg font-medium text-text">
                Drop any file here
              </p>
              <p className="mt-2 font-body text-[13px] leading-[18px] text-text-secondary">
                The working upload box lands in an upcoming build phase — the
                tools below are on their way.
              </p>
              <span className="mt-4 inline-block rounded-badge bg-icon-bg px-2.5 py-1 font-mono text-[11px] font-medium text-signal">
                PDF · DOCX · XLSX · PPTX · JPG · PNG
              </span>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Category grid — alternate section: white */}
      <section id="categories" className="scroll-mt-24 bg-white py-20">
        <PageContainer>
          <h2 className="font-display text-[28px] font-medium leading-9 text-text">
            The workbenches
          </h2>
          <p className="mt-2 max-w-xl font-body text-base leading-6 text-text-secondary">
            Twenty-seven tools across five benches, each built to do one job
            properly.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map(({ name, description, badge, icon: Icon }) => (
              <div key={name} className={CARD_CLASSES}>
                <div className="flex h-12 w-12 items-center justify-center rounded-card bg-icon-bg text-text transition-colors group-hover:text-signal">
                  <Icon size={26} strokeWidth={2} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <h3 className="font-display text-xl font-medium leading-7 text-text">
                    {name}
                  </h3>
                  <span className="rounded-badge bg-paper px-2 py-0.5 font-mono text-[11px] font-medium text-signal">
                    {badge}
                  </span>
                </div>
                <p className="mt-2 font-body text-[13px] leading-[18px] text-text-secondary">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Why Zenfyle — rhythm section: paper-alt */}
      <section id="why" className="scroll-mt-24 border-t border-border bg-paper-alt py-20">
        <PageContainer>
          <h2 className="font-display text-[28px] font-medium leading-9 text-text">
            Why Zenfyle
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {VALUE_PROPS.map(({ title, description, icon: Icon }) => (
              <div key={title} className={CARD_CLASSES}>
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-icon-bg text-text transition-colors group-hover:text-signal">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-display text-xl font-medium leading-7 text-text">
                  {title}
                </h3>
                <p className="mt-2 font-body text-[13px] leading-[18px] text-text-secondary">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>
    </>
  );
}
