import Link from "next/link";
import { Menu, Search } from "lucide-react";

/*
 * Section 3: sticky header, 72px desktop / 60px mobile.
 * v1.2.0 palette: gradient #102A43 → #0C2036, logo #F8FAFC, nav #CBD5E1
 * with --signal hover, Log-in #CBD5E1 → #F8FAFC hover.
 *
 * Phase 1 renders the header's structure and tokens only. The mega-menu
 * dropdowns, sliding underline, and mobile drawer are Phase 2 (Section 9) and
 * intentionally absent here — tabs are static labels until then.
 */

const NAV_TABS = [
  "Merge & Organize",
  "Convert",
  "Compress & Optimize",
  "Edit & Sign",
  "Security",
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 h-[60px] w-full bg-gradient-to-b from-ink to-ink-deep md:h-[72px]">
      {/* Desktop layout (>= 768px) */}
      <div className="hidden h-full items-center pl-6 md:flex">
        <Link
          href="/"
          className="font-display text-xl font-semibold text-nav-bright"
        >
          Zenfyle
        </Link>
        <nav aria-label="Tools" className="ml-[100px] flex h-full items-center gap-8 lg:ml-[180px]">
          {NAV_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className="relative flex h-full items-center font-display text-[15px] font-medium leading-none text-nav transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-signal after:transition-transform after:duration-200 hover:text-signal hover:after:scale-x-100"
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-6 pr-6">
          <button
            type="button"
            aria-label="Search tools"
            className="text-nav transition-colors hover:text-signal"
          >
            <Search size={20} strokeWidth={2} />
          </button>
          <Link
            href="/login"
            className="font-body text-[15px] font-medium text-nav transition-colors hover:text-nav-bright"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-card bg-signal px-4 py-2.5 font-body text-[15px] font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_16px_rgba(255,107,53,0.36)]"
          >
            Sign up free
          </Link>
        </div>
      </div>

      {/* Mobile layout (< 768px): hamburger left, logo center, signup right */}
      <div className="flex h-full items-center justify-between px-4 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center text-nav-bright"
        >
          <Menu size={24} strokeWidth={2} />
        </button>
        <Link href="/" className="font-display text-lg font-semibold text-nav-bright">
          Zenfyle
        </Link>
        <Link
          href="/signup"
          aria-label="Sign up"
          className="flex h-11 items-center rounded-card bg-signal px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-signal-hover"
        >
          Sign up
        </Link>
      </div>
    </header>
  );
}
